/* eslint-disable complexity, max-statements */
'use strict';

require('./utils/initial-setup');
require('./utils/font-setup');

var debug = require('debug-proxy')('app:router-app');
var $ = require('jquery');
var _ = require('lodash');
var Backbone = require('backbone');
var moment = require('moment');
var clientEnv = require('gitter-client-env');

var onready = require('./utils/onready');
var urlParser = require('./utils/url-parser');
var RAF = require('./utils/raf');
var appEvents = require('./utils/appevents');
var context = require('gitter-web-client-context');
var toggleDarkTheme = require('./utils/toggle-dark-theme');

var TitlebarUpdater = require('./components/titlebar');
var realtime = require('./components/realtime');
const userNotifications = require('./components/user-notifications');
var RoomCollectionTracker = require('./components/room-collection-tracker');
var SPARoomSwitcher = require('./components/spa-room-switcher');
var linkHandler = require('./components/link-handler');
var roomListGenerator = require('./components/chat-cache/room-list-generator');
var troupeCollections = require('./collections/instances/troupes');
var AppLayout = require('./views/layouts/app-layout');
var LoadingView = require('./views/app/loading-view');
var RoomMenuModel = require('./models/room-menu-model');
var modalRegion = require('./components/modal-region');
var DNDCtrl = require('./components/menu/room/dnd-controller');
var Router = require('./routes/router');
var notificationRoutes = require('./routes/notification-routes');
var createRoutes = require('./routes/create-routes');
var upgradeAccessRoutes = require('./routes/upgrade-access-routes');
var userRoutes = require('./routes/user-routes');

require('./components/statsc');
require('./views/widgets/preload');
require('./template/helpers/all');
require('./components/bug-reporting');
require('./components/focus-events');

require('./utils/tracking');
require('./components/ping');

// Preload widgets
require('./views/widgets/avatar');

userNotifications.initUserNotifications();

const useVueLeftMenu = context.hasFeature('vue-left-menu');

onready(function() {
  let dialogRegion;
  let roomMenuModel;
  if (useVueLeftMenu) {
    dialogRegion = modalRegion;

    const dndCtrl = new DNDCtrl();
    roomMenuModel = new RoomMenuModel(
      _.extend({}, context.getSnapshot('leftMenu'), {
        bus: appEvents,
        roomCollection: troupeCollections.troupes,
        orgCollection: troupeCollections.orgs,
        userModel: context.user(),
        troupeModel: context.troupe(),
        dndCtrl: dndCtrl,
        groupsCollection: troupeCollections.groups
      })
    );
  } else {
    const appLayout = new AppLayout({
      template: false,
      el: 'body',
      roomCollection: troupeCollections.troupes,
      //TODO ADD THIS TO MOBILE JP 25/1/16
      orgCollection: troupeCollections.orgs,
      groupsCollection: troupeCollections.groups
    });
    appLayout.render();

    dialogRegion = appLayout.dialogRegion;
    roomMenuModel = appLayout.getRoomMenuModel();
  }

  var router = new Router({
    dialogRegion: dialogRegion,
    routes: [
      userRoutes(),
      notificationRoutes(),
      createRoutes({
        rooms: troupeCollections.troupes,
        groups: troupeCollections.groups,
        roomMenuModel: roomMenuModel
      }),
      upgradeAccessRoutes()
    ]
  });

  Backbone.history.stop();
  Backbone.history.start();

  var titlebarUpdater = new TitlebarUpdater();

  let chatIFrame;
  if (!useVueLeftMenu) {
    chatIFrame = document.getElementById('content-frame');

    new LoadingView(chatIFrame, document.getElementById('loading-frame'));

    // Send the hash to the child
    if (window.location.hash) {
      var noHashSrc = chatIFrame.src.split('#')[0];
      chatIFrame.src = noHashSrc + window.location.hash;
    }
  }

  let state;
  if (useVueLeftMenu) {
    state = window.location.href;
  } else {
    state = chatIFrame.src;
  }

  /* Replace the `null` state on startup with the real state, so that when a client clicks back to the
   * first page of gitter, we know what the original URL was (instead of null)
   */
  window.history.replaceState(state, '', window.location.href);

  /* TODO: add the link handler here? */
  require('./components/link-handler').installLinkHandler();

  /*
   * Push State Management
   */

  function initChatCache() {
    if (troupeCollections.troupes.length) {
      postMessage({
        type: 'roomList',
        rooms: roomListGenerator(troupeCollections.troupes)
      });
    } else {
      //if we don't have any troupes in the troupeCollection
      //wait for it to sync before posting the message
      troupeCollections.troupes.once('sync', function() {
        postMessage({
          type: 'roomList',
          rooms: roomListGenerator(troupeCollections.troupes)
        });
      });
    }
  }

  function getContentFrameLocation() {
    var contentFrame = document.querySelector('#content-frame');
    return contentFrame.contentWindow.location;
  }

  const roomSwitcher = new SPARoomSwitcher(
    troupeCollections.troupes,
    clientEnv.basePath,
    getContentFrameLocation
  );
  roomSwitcher.on('replace', function(href) {
    debug('Room switch: replace %s', href);

    context.setTroupeId(undefined); // TODO: update the title....
    /*
     * Use location.replace so as not to affect the history state of the application
     *
     * The history has already been pushed via the pushstate, so we don't want to double up
     */
    RAF(function() {
      getContentFrameLocation().replace(href);
    });
  });

  roomSwitcher.on('reload', function() {
    debug('Room switch: reload');
    context.setTroupeId(undefined); // TODO: update the title....
    RAF(function() {
      getContentFrameLocation().reload(true);
    });
  });

  roomSwitcher.on('switch', function(troupe, permalinkChatId) {
    debug('Room switch: switch to %s', troupe.attributes);

    context.setTroupeId(troupe.id);

    // turn backbone object to plain one so we don't modify the original
    var newTroupe = troupe.toJSON();

    // Set the last access time immediately to prevent
    // delay in hidden rooms becoming visible only
    // once we get the server-side update
    var liveCollectionTroupe = troupeCollections.troupes.get(troupe.id);
    if (liveCollectionTroupe) {
      liveCollectionTroupe.set('lastAccessTime', moment());
    }

    // add the group to the troupe as if it was serialized by the server
    var groupModel = troupeCollections.groups.get(newTroupe.groupId);
    if (groupModel) {
      newTroupe.group = groupModel.toJSON();
    }

    //post a navigation change to the iframe
    postMessage({
      type: 'change:room',
      newTroupe: newTroupe,
      permalinkChatId: permalinkChatId
    });
  });

  function pushState(state, title, url) {
    if (state === window.history.state) {
      // Don't repush the same state...
      return;
    }

    titlebarUpdater.setRoomName(title);
    window.history.pushState(state, title, url);
    appEvents.trigger('track', url);
  }

  /* Deal with the popstate */
  window.onpopstate = function(e) {
    var iframeUrl = e.state;
    if (!iframeUrl) return;

    //generate title
    var urlDetails = urlParser.parse(iframeUrl);
    var pageTitle = urlDetails.pathname.split('/');
    pageTitle.pop();
    pageTitle = pageTitle.join('/');
    pageTitle = pageTitle.substring(1);

    //update title
    titlebarUpdater.setRoomName(pageTitle);

    //switch rooms
    roomSwitcher && roomSwitcher.change(iframeUrl);
  };

  // Called from the OSX native client for faster page loads
  // when clicking on a chat notification
  window.gitterLoader = function(url) {
    if (url[0] !== '/') {
      url = '/' + url;
    }

    var parsed = urlParser.parse(url);
    linkHandler.routeLink(parsed, { appFrame: true });
  };

  function onUnreadItemsCountMessage(message) {
    var count = message.count;
    var troupeId = message.troupeId;
    if (troupeId !== context.getTroupeId()) {
      debug(
        'troupeId mismatch in unreadItemsCount: got',
        troupeId,
        'expected',
        context.getTroupeId()
      );
    }

    var v = {
      unreadItems: count
    };

    if (count === 0) {
      // If there are no unread items, there can't be unread mentions
      // either
      v.mentions = 0;
    }

    debug('Received unread count message: troupeId=%s, update=%j ', troupeId, v);
    allRoomsCollection.patch(troupeId, v);
  }

  function onClearActivityBadgeMessage(message) {
    var troupeId = message.troupeId;
    allRoomsCollection.patch(troupeId, { activity: 0 });
  }

  window.addEventListener(
    'message',
    function(e) {
      if (e.origin !== clientEnv.basePath) {
        debug('Ignoring message from %s', e.origin);
        return;
      }

      var message;
      try {
        message = JSON.parse(e.data);
      } catch (err) {
        /* It seems as through chrome extensions use this event to pass messages too. Ignore them. */
        return;
      }

      debug('Received message %j', message);

      var makeEvent = function(message) {
        var origin = 'chat';
        if (message.event && message.event.origin) origin = message.event.origin;
        message.event = {
          origin: origin,
          preventDefault: function() {},
          stopPropagation: function() {},
          stopImmediatePropagation: function() {}
        };
      };

      switch (message.type) {
        case 'context.troupeId':
          context.setTroupeId(message.troupeId);
          titlebarUpdater.setRoomName(message.name);
          appEvents.trigger('context.troupeId', message.troupeId);
          break;

        case 'navigation':
          appEvents.trigger(
            'navigation',
            message.url,
            message.urlType,
            message.title,
            message.options
          );
          break;

        case 'route':
          window.location.hash = '#' + message.hash;
          break;

        // case 'route-silent':
        //   var routeCb = router.routes[message.hash];
        //   if(routeCb) {
        //     routeCb.apply(router, message.args);
        //   }
        //   break;

        //when the chat app requests the room list send it
        case 'request:roomList':
          initChatCache();
          break;

        case 'unreadItemsCount':
          onUnreadItemsCountMessage(message);
          break;

        case 'clearActivityBadge':
          onClearActivityBadgeMessage(message);
          break;

        case 'realtime.testConnection':
          var reason = message.reason;
          realtime.testConnection('chat.' + reason);
          break;

        // No parameters
        case 'chat.edit.hide':
        case 'chat.edit.show':
        case 'ajaxError':
          appEvents.trigger(message.type);
          break;

        case 'keyboard':
          makeEvent(message);
          message.name = message.name || '';
          //patch the event key value as this is needed and seems to get lost
          message.event.key = message.name.split('.').pop();
          appEvents.trigger('keyboard.' + message.name, message.event, message.handler);
          appEvents.trigger('keyboard.all', message.name, message.event, message.handler);
          break;

        case 'focus':
          makeEvent(message);
          appEvents.trigger('focus.request.' + message.focus, message.event);
          break;

        case 'childframe:loaded':
          appEvents.trigger('childframe:loaded');
          roomSwitcher && roomSwitcher.setIFrameLoadingState(false);
          break;

        case 'permalink.requested':
          var url = message.url + '?at=' + message.id;
          var frameUrl = message.url + '/~' + message.permalinkType + '?at=' + message.id;
          var title = message.url.substring(1);
          pushState(frameUrl, title, url);
          break;

        case 'toggle-dark-theme':
          toggleDarkTheme(!!message.theme.length);
          break;
      }
    },
    false
  );

  var allRoomsCollection = troupeCollections.troupes;
  new RoomCollectionTracker(allRoomsCollection);

  const onRoomRemoveHandler = function(model) {
    if (model.id === context.getTroupeId()) {
      //context.troupe().set('roomMember', false);
      var newLocation = '/home';
      var newFrame = '/home/~home';
      var title = 'home';

      pushState(newFrame, title, newLocation);
      roomSwitcher && roomSwitcher.change(newFrame);
    }
  };

  allRoomsCollection.on('remove', onRoomRemoveHandler);

  // We remove `onRoomRemoveHandler` so we don't try to redirect to the user home
  // before the `logout()` kicks in (see `delete-account-view.js`)
  appEvents.on('account.delete-start', function() {
    allRoomsCollection.off('remove', onRoomRemoveHandler);
  });

  function postMessage(message) {
    if (!useVueLeftMenu) {
      const targetWindow = chatIFrame.contentWindow;
      targetWindow.postMessage(JSON.stringify(message), clientEnv.basePath);
    }
  }

  appEvents.on('navigation', function(url, type, title, options) {
    debug('navigation: %s', url);
    options = options || {};
    var parsed = urlParser.parse(url);
    var frameUrl = parsed.pathname + '/~' + type + parsed.search;

    if (!url && options.refresh) {
      window.location.reload();
      return;
    }

    if (parsed.pathname === window.location.pathname) {
      pushState(frameUrl, title, url);
      postMessage({
        type: 'permalink.navigate',
        query: urlParser.parseSearch(parsed.search)
      });
      return;
    }

    //Update windows location
    pushState(frameUrl, title, url);

    if (options.disableFrameReload) {
      return;
    }

    if (useVueLeftMenu) {
      if (type === 'iframe') {
        window.location.href = url;
      }
    }

    //Redirect the App
    roomSwitcher && roomSwitcher.change(frameUrl);
  });

  // Call preventDefault() on tab events so that we can manage focus as we want
  appEvents.on('keyboard.tab.next keyboard.tab.prev', function(e) {
    if (!e.origin) e.preventDefault();
  });

  // Send focus events to chat frame
  appEvents.on('focus.request.chat.in', function(event) {
    postMessage({
      type: 'focus',
      focus: 'in',
      event: event
    });
  });

  appEvents.on('focus.request.chat.out', function(event) {
    postMessage({
      type: 'focus',
      focus: 'out',
      event: event
    });
  });

  appEvents.on('about.to.leave.current.room', function() {
    postMessage({
      type: 'about.to.leave.current.room'
    });
  });

  appEvents.on('room-menu:pin', function(val) {
    $('.app-layout').toggleClass('pinned', val);
  });

  // Sent keyboard events to chat frame
  appEvents.on('keyboard.all', function(name, event, handler) {
    // Don't send back events coming from the chat frame
    if (event.origin && event.origin === 'chat') return;
    var message = {
      type: 'keyboard',
      name: name,

      // JSON serialisation makes it not possible to send the event object
      // Keep track of the origin in case of return
      event: {
        origin: event.origin
      },
      handler: handler
    };
    postMessage(message);
  });

  if (context.popEvent('invite_failed')) {
    appEvents.trigger('user_notification', {
      title: 'Unable to join room',
      text:
        'Unfortunately we were unable to add you to the requested room. Please ' +
        'check that you have appropriate access and try again.',
      timeout: 12000
    });
  }

  if (context.popEvent('new_user_signup')) {
    require.ensure('scriptjs', function(require) {
      var $script = require('scriptjs');
      $script('//platform.twitter.com/oct.js', function() {
        var twitterOct = window.twttr && window.twttr.conversion;
        // Will no exist if it's been blocked by ad-blockers
        if (!twitterOct) return;
        twitterOct.trackPid('l4t99');
      });
    });
  }

  // Fingerprint the user
  setTimeout(function() {
    var fingerprint = require('./components/fingerprint');
    fingerprint();
  }, 5000);

  // Register the service worker
  if (context.hasFeature('web-push')) {
    setTimeout(function() {
      require('gitter-web-service-worker/browser/registration').install({
        apiClient: require('./components/api-client')
      });
    }, 10000);
  }

  if (useVueLeftMenu) {
    // Initialize Vue stuff
    require('./vue/initialize-clientside');
  }
});
