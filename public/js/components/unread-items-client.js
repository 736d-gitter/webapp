/*jshint strict:true, undef:true, unused:strict, browser:true *//* global define:false */
define([
  'jquery',
  'underscore',
  'utils/context',
  './realtime',
  'log!unread-items-client',
  'backbone',
  './csrf',
  'utils/appevents',
  'utils/dataset-shim',
  'utils/double-hash'
], function($, _, context, realtime, log, Backbone, csrf, appEvents, dataset, DoubleHash) {
  "use strict";

  function limit(fn, context, timeout) {
    return _.debounce(_.bind(fn, context), timeout || 30);
  }

  function _iteratePreload(items, fn, context) {
    var keys = _.keys(items);
    _.each(keys, function(itemType) {
      _.each(items[itemType], function(itemId) {
        fn.call(context, itemType, itemId);
      });
    });
  }

  var ADD_TIMEOUT = 500;
  var REMOVE_TIMEOUT = 600000;

  // -----------------------------------------------------
  // A doublehash which slows things down
  // -----------------------------------------------------

  var Tarpit = function(timeout, onDequeue) {
    DoubleHash.call(this);
    this._timeout = timeout;
    this._onDequeue = onDequeue;
  };

  _.extend(Tarpit.prototype, DoubleHash.prototype, {
    _onItemAdded: function(itemType, itemId) {
      var self = this;
      window.setTimeout(function() {
        self._promote(itemType, itemId);
      }, this._timeout);
    },

    _promote: function(itemType, itemId) {
      // Has this item already been deleted?
      if(!this._contains(itemType, itemId)) return;

      this._remove(itemType, itemId);
      if(this._onDequeue) this._onDequeue(itemType, itemId);
    }
  });

  // -----------------------------------------------------
  // The main component of the unread-items-store
  // -----------------------------------------------------

  var UnreadItemStore = function() {
    DoubleHash.call(this);

    this._addTarpit = new Tarpit(ADD_TIMEOUT, _.bind(this._promote, this));
    this._deleteTarpit = new Tarpit(REMOVE_TIMEOUT);
    this._recountLimited = limit(this._recount, this, 30);
    this._currentCountValue = undefined;
  };

  _.extend(UnreadItemStore.prototype, Backbone.Events, DoubleHash.prototype, {
    _unreadItemAdded: function(itemType, itemId) {
      if(this._deleteTarpit._contains(itemType, itemId)) return;
      if(this._contains(itemType, itemId)) return;

      this._addTarpit._add(itemType, itemId);
      this._recountLimited();
    },

    _unreadItemRemoved: function(itemType, itemId) {
      if(this._deleteTarpit._contains(itemType, itemId)) return;

      this._deleteTarpit._add(itemType, itemId);
      this._addTarpit._remove(itemType, itemId);
      this._remove(itemType, itemId);

      this.trigger('unreadItemRemoved', itemType, itemId);
      this._recountLimited();
    },

    _markItemRead: function(itemType, itemId, mentioned) {
      this._unreadItemRemoved(itemType, itemId);
      this.trigger('itemMarkedRead', itemType, itemId, mentioned);
    },

    _onItemRemoved: function() {
      // Recount soon
      this._recountLimited();
    },

    _onItemAdded: function() {
      // Recount soon
      this._recountLimited();
    },

    _promote: function(itemType, itemId) {
      this._add(itemType, itemId);
    },

    _recount: function() {
      var newValue = this._count();

      if(this._currentCountValue !== newValue) {
        this._currentCountValue = newValue;
        this.trigger('newcountvalue', newValue);
        appEvents.trigger('unreadItemsCount', newValue);
      }

      return newValue;
    },

    _currentCount: function() {
      if(this._currentCountValue) return this._currentCountValue;

      return 0;
    },

    _unreadItemsAdded: function(items) {
      _iteratePreload(items, function(itemType, itemId) {
        this._unreadItemAdded(itemType, itemId);
      }, this);
    },

    _unreadItemsRemoved: function(items) {
      _iteratePreload(items, function(itemType, itemId) {
        this._unreadItemRemoved(itemType, itemId);
      }, this);
    },

    _hasItemBeenMarkedAsRead: function(itemType, itemId) {
      return this._deleteTarpit._contains(itemType, itemId);
    },

    preload: function(items) {
      _iteratePreload(items, function(itemType, itemId) {
        log('Preload of ' + itemType + ':' + itemId);

        // Have we already marked this item as read?
        if(this._deleteTarpit._contains(itemType, itemId)) return;

        // Have we already got this item in our store?
        if(this._contains(itemType, itemId)) return;

        // Instantly promote it...
        this._promote(itemType, itemId);
      }, this);
    }

  });

  // -----------------------------------------------------
  // This component sends read notifications back to the server
  // -----------------------------------------------------

  var ReadItemSender = function(unreadItemStore) {
    this._buffer = new DoubleHash();
    this._sendLimited = limit(this._send, this, 1000);

    _.bindAll(this,'_onItemMarkedRead', '_onWindowUnload');

    unreadItemStore.on('itemMarkedRead', this._onItemMarkedRead);
    $(window).on('unload', this._onWindowUnload);
    $(window).on('beforeunload', this._onWindowUnload);
  };

  ReadItemSender.prototype = {
    _onItemMarkedRead: function(itemType, itemId, mentioned) {
      // This is a bit of a hack, but seeing as the only itemType is chat, it's forgivable
      if(mentioned) {
        itemType = 'mention';
      }

      this._add(itemType, itemId);
    },

    _onWindowUnload: function() {
      if(this._buffer._count() > 0) {
        this._send({ sync: true });
      }
    },

    _add: function(itemType, itemId) {
      this._buffer._add(itemType, itemId);
      this._sendLimited();
    },

    _send: function(options) {
      var queue = this._buffer._marshall();
      this._buffer = new DoubleHash();

      var async = !options || !options.sync;
      var url = '/api/v1/user/' + context.getUserId() + '/troupes/' + context.getTroupeId() + '/unreadItems';

      $.ajax({
        url: url,
        contentType: "application/json",
        data: JSON.stringify(queue),
        async: async,
        beforeSend: csrf,
        type: "POST",
        global: false,
        success: function() {
        },
        error: function() {
        }
      });

    }
  };

  // -----------------------------------------------------
  // Sync unread items with realtime notifications coming from the server
  // -----------------------------------------------------

  var TroupeUnreadItemRealtimeSync = function(unreadItemStore) {
    this._store = unreadItemStore;
  };

  _.extend(TroupeUnreadItemRealtimeSync.prototype, Backbone.Events, {
    _subscribe: function() {
      var store = this._store;

      var url = '/api/v1/user/' + context.getUserId() + '/troupes/' + context.getTroupeId() + '/unreadItems';
      realtime.subscribe(url, function(message) {
        if(message.notification === 'unread_items') {
          store._unreadItemsAdded(message.items);
        } else if(message.notification === 'unread_items_removed') {
          var items = message.items;
          store._unreadItemsRemoved(items);

          // _iteratePreload(items, function(itemType, itemId) {
          //   this.trigger('unreadItemRemoved', itemType, itemId);
          // }, self);
        }
      });

      realtime.registerForSnapsnots(url, function(snapshot) {
          store.preload(snapshot);
      });
    }
  });

  // -----------------------------------------------------
  // Monitors the view port and tells the store when things
  // have been read
  // -----------------------------------------------------

  var TroupeUnreadItemsViewportMonitor = function(scrollElement, unreadItemStore) {
    _.bindAll(this, '_getBounds');

    this._scrollElement = scrollElement[0] || scrollElement;

    this._store = unreadItemStore;
    this._windowScrollLimited = limit(this._windowScroll, this, 50);

    var foldCountLimited = limit(this._foldCount, this, 50);
    this._foldCountLimited = foldCountLimited;
    this._inFocus = true;

    appEvents.on('eyeballStateChange', this._eyeballStateChange, this);


    this._scrollElement.addEventListener('scroll', this._getBounds, false);

    // this is not a live collection so this will not work inside an SPA
    //$('.mobile-scroll-class').on('scroll', this._getBounds);

    appEvents.on('unreadItemDisplayed', this._getBounds);

    unreadItemStore.on('unreadItemRemoved', foldCountLimited);
    // unreadItemStore.on('unreadItemRemoved', this._unreadItemRemoved, this);

    // When the UI changes, rescan
    // appEvents.on('appNavigation', this._getBounds);
    setTimeout(this._getBounds, 250);
  };

  TroupeUnreadItemsViewportMonitor.prototype = {
    _getBounds: function() {
      if(!this._inFocus) {
        this._foldCountLimited();
        return;
      }

      var scrollTop = this._scrollElement.scrollTop;
      var scrollBottom = scrollTop + this._scrollElement.clientHeight;

      if(!this._scrollTop || scrollTop < this._scrollTop) {
        this._scrollTop = scrollTop;
      }

      if(!this._scrollBottom || scrollBottom > this._scrollBottom) {
        this._scrollBottom = scrollBottom;
      }

      this._windowScrollLimited();
    },

    // _unreadItemRemoved: function(itemType, itemId) {
    //   console.log('REMOVED itemType itemId', itemType, itemId);
    // },

    _windowScroll: function() {
      if(!this._inFocus) {
        return;
      }

      var self = this;

      var topBound = this._scrollTop;
      var bottomBound = this._scrollBottom;

      delete this._scrollTop;
      delete this._scrollBottom;

      var unreadItems = this._scrollElement.querySelectorAll('.unread');

      var timeout = 1000;
      var below = 0;
      /* Beware, this is not an array, it's a nodelist. We can't use array methods like forEach  */
      for(var i = 0; i < unreadItems.length; i++) {
        var element = unreadItems[i];

        var itemType = dataset.get(element, 'itemType');
        var itemId = dataset.get(element, 'itemId');
        var mentioned = dataset.get(element, 'mentioned') === 'true';

        if(itemType && itemId) {
          var top = element.offsetTop;

          if (top >= topBound && top <= bottomBound) {
            var $e = $(element);

            self._store._markItemRead(itemType, itemId, mentioned);

            $e.removeClass('unread').addClass('reading');
            this._addToMarkReadQueue($e);
            timeout = timeout + 150;
          } else if(top > bottomBound) {
            // This item is below the bottom fold
            below++;
          } else if(top < topBound) {
            // This item is above the top fold

          }
        }

      }

      var total = self._store._recount();
      var above = total - below;
      acrossTheFoldModel.set('unreadAbove', above);
      acrossTheFoldModel.set('unreadBelow', below);
    },

    _foldCount: function() {
      var self = this;

      var topBound = this._scrollElement.scrollTop;
      var bottomBound = topBound + this._scrollElement.clientHeight;

      var unreadItems = this._scrollElement.querySelectorAll('.unread');

      var below = 0, inframe = 0;
      /* Beware, this is not an array, it's a nodelist. We can't use array methods like forEach  */
      for(var i = 0; i < unreadItems.length; i++) {
        var element = unreadItems[i];

        var itemType = dataset.get(element, 'itemType');
        var itemId = dataset.get(element, 'itemId');

        if(itemType && itemId) {
          var top = element.offsetTop;

          if (top >= topBound && top <= bottomBound) {
            inframe++;
          } else if(top > bottomBound) {
            // This item is below the bottom fold
            below++;
          }
        }

      }


      var total = self._store._recount();
      var above = total - below - inframe;
      acrossTheFoldModel.set('unreadAbove', above);
      acrossTheFoldModel.set('unreadBelow', below);
    },

    _scheduleMarkRead: function() {
      if(this._markQueue.length !== 0 && !this._timer) {
        var timeout = 300 / this._markQueue.length;
        this._timer = setTimeout(this._markRead.bind(this), timeout);
      }
    },

    _addToMarkReadQueue: function($e) {
      if(!this._markQueue) this._markQueue = [];
      this._markQueue.push($e);
      this._scheduleMarkRead();
    },

    _markRead: function() {
      this._timer = null;
      var $e = this._markQueue.shift();
      if($e) $e.removeClass('reading').addClass('read');
      this._scheduleMarkRead();
    },

    _eyeballStateChange: function(newState) {
      this._inFocus = newState;
      if(newState) {
        this._getBounds();
      }
    }
  };


  // -----------------------------------------------------
  // Monitors the store and removes the css for items that
  // have been read
  // -----------------------------------------------------
  var ReadItemRemover = function(realtimeSync) {
    realtimeSync.on('unreadItemRemoved', this._onUnreadItemRemoved);
  };

  ReadItemRemover.prototype = {
    _onUnreadItemRemoved: function(itemType, itemId) {
      var elements = $('.model-id-' + itemId);
      elements.removeClass('unread').addClass('read');
    }
  };

  var _unreadItemStore;

  /**
   * Returns an instance of the unread items store,
   * or throws an error if it's not obtainable
   */
  function getUnreadItemStore() {
    if(_unreadItemStore) return _unreadItemStore;

    if(context.getUserId() && context.troupe().id) {
      _unreadItemStore = new UnreadItemStore();
      new ReadItemSender(_unreadItemStore);
      var realtimeSync = new TroupeUnreadItemRealtimeSync(_unreadItemStore);
      realtimeSync._subscribe();
      new ReadItemRemover(realtimeSync);

      return _unreadItemStore;
    }

    return null;

  }

  /**
   * Returns an instance of the unread items store,
   * or throws an error if it's not obtainable
   */
  function getUnreadItemStoreReq() {
    var store = getUnreadItemStore();
    if(store) return store;

    throw new Error("Unable to create an unread items store without a user");
  }


  var acrossTheFoldModel = new Backbone.Model({
    defaults: {
      unreadAbove: 0,
      unreadBelow: 0
    }
  });


  var unreadItemsClient = {
    acrossTheFold: function() {
      return acrossTheFoldModel;
    },

    hasItemBeenMarkedAsRead: function(itemType, itemId) {
      var unreadItemStore = getUnreadItemStoreReq();

      if(!unreadItemStore) {
        return false;
      }

      return unreadItemStore._hasItemBeenMarkedAsRead(itemType, itemId);
    },

    syncCollections: function(collections) {
      var unreadItemStore = getUnreadItemStoreReq();

      unreadItemStore.on('itemMarkedRead', function(itemType, itemId, mention) {
        var collection = collections[itemType];
        if(!collection) return;

        var v = { unread: false };

        if(mention) {
          v.mentioned = false;
        }

        collection.patch(itemId, v, { silent: true });
      });

      unreadItemStore.on('unreadItemRemoved', function(itemType, itemId) {
        var collection = collections[itemType];
        if(!collection) return;


        var v = { unread: false, mentioned: false };
        collection.patch(itemId, v);
      });
    },

    monitorViewForUnreadItems: function($el) {
      var unreadItemStore = getUnreadItemStoreReq();

      return new TroupeUnreadItemsViewportMonitor($el, unreadItemStore);
    }
  };

  // Mainly useful for testing
  unreadItemsClient.getStore = function() { return _unreadItemStore; };
  unreadItemsClient.DoubleHash = DoubleHash;
  unreadItemsClient.Tarpit = Tarpit;
  unreadItemsClient.UnreadItemStore = UnreadItemStore;

  return unreadItemsClient;
});
