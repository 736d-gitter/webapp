/*jshint strict:true, undef:true, unused:strict, browser:true *//* global define:false */
define([
  'backbone',
  'underscore',
  'log!smart-list'
], function(Backbone, _, log) {
  "use strict";

  // higher index in array, higher rank
  var roleRank = ['contributor', 'admin'];

  function compareRoles(userA, userB) {
    var aRole = userA.get('role');
    var bRole = userB.get('role');

    return roleRank.indexOf(aRole) - roleRank.indexOf(bRole);
  }

  function compareNames(userA, userB) {
    var aName = userA.get('displayName') || userA.get('username') || '';
    var bName = userB.get('displayName') || userB.get('username') || '';

    return bName.toLowerCase().localeCompare(aName.toLowerCase());
  }

  var MegaCollection = Backbone.Collection.extend({
    initialize: function(models, options) {
      var userList = options.users;

      this.sortLimited = _.debounce(function() { this.sort(); }.bind(this), 10);

      this.listenTo(userList, 'add', this.parentAdd);
      this.listenTo(userList, 'remove', this.parentRemove);
      this.listenTo(userList, 'reset', this.parentReset);

      // this.listenTo(userList, 'change:displayName change:username change:role', this.sortLimited);

    },

    disconnect: function() {
      this.stopListening();
    },

    parentAdd: function(model) {
      this.add(model);
    },

    parentRemove: function(model) {
      this.remove(model);
    },

    parentReset: function(collection) {
      this.reset(collection.models);
    },

    // lower in array is better
    comparator: function(userA, userB) {
      var roleDifference = compareRoles(userA, userB);

      if(roleDifference !== 0) {
        return - roleDifference;
      } else {
        return - compareNames(userA, userB);
      }
    }
  });

  var LimitedCollection = Backbone.Collection.extend({
    initialize: function(models, options) {
      var collection = new MegaCollection([], { users: options.users });

      this.underlying = collection;
      this.limit = options.limit || 10;
      this.comparator = function(item) {
        return item._sortIndex;
      };

      this.listenTo(collection, 'add', this.underlyingAdd);
      this.listenTo(collection, 'remove', this.underlyingRemove);
      this.listenTo(collection, 'reset', this.underlyingReset);
      this.listenTo(collection, 'sort', this.underlyingSort);
    },

    setLimit: function(limit) {
      if(limit !== this.limit) {
        this.limit = limit;
        this.underlyingSort();
      }
    },

    underlyingAdd: function(model, collection) {
      var position = collection.indexOf(model);
      if(position >= this.limit) return;

      model._sortIndex = position;
      this.add(model, { at: position });
      while(this.length >= this.limit) {
        this.pop();
      }
    },

    underlyingRemove: function() {
      this.underlyingSort();
    },

    underlyingReset: function() {
      this.underlyingSort();
    },

    analyse: function() {
      var orderBreaks = 0;
      var firstOutOfOrderElement = -1;

      var prev = this.comparator(this.models[0]);
      for(var i = 1; i < this.models.length; i++) {
        var curr = this.comparator(this.models[i]);
        if(curr < prev) {
          orderBreaks++;
          if(orderBreaks == 1) {
            firstOutOfOrderElement = i;
          } else if(orderBreaks > 1) {
            break;
          }
        }
      }

      return { breaks: orderBreaks, first: firstOutOfOrderElement };
    },

    underlyingSort: function() {
      var newItems = this.underlying.take(this.limit);

      var originalOrder = newItems.reduce(function(memo, value, index) {
        memo[value.id] = index;
        return memo;
      }, {});

      newItems = _.chain(newItems);

      var self = this;
      var removals = [];
      self.forEach(function(item) {
        var i = originalOrder[item.id];

        if(i >= 0) {
          newItems = newItems.without(item);
          item._sortIndex = i;
        } else {
          removals.push(item);
        }
      });

      // Bulk the operation for performance
      if(removals.length) {
        this.remove(removals);
      }

      newItems.forEach(function(item) {
        var i = originalOrder[item.id];
        item._sortIndex = i;
        self.add(item, { at: i });
      });

      self.sort();
    }
  });

  return {
    SortedAndLimited: LimitedCollection,
    Sorted: MegaCollection
  };

});
