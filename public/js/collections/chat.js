"use strict";
var _ = require('underscore');
var Backbone = require('backbone');
var context = require('utils/context');
var apiClient = require('components/apiClient');
var moment = require('moment');
var burstCalculator = require('../utils/burst-calculator');
var InfiniteCollectionMixin = require('./infinite-mixin');
var cocktail = require('cocktail');
var log = require('utils/log');
var LiveCollection = require('gitter-realtime-client').LiveCollection;
var realtime = require('components/realtime');
var SyncMixin = require('./sync-mixin');

var userId = context.getUserId();

var ChatModel = Backbone.Model.extend({
  idAttribute: "id",
  initialize: function() {
    this.listenTo(this, 'sync', this.triggerSynced);
    this.listenTo(this, 'request', this.triggerSyncing);
    this.listenTo(this, 'error', this.triggerSyncError);

    /* When the chat is removed from the collection, stop listening to events */
    this.listenTo(this, 'remove', function() {
      this.stopListening(this);
    });

  },


  triggerSynced: function() {
    this.trigger('syncStatusChange', 'synced');
  },

  /* Gunter: Help! I am syncing! William: What are you syncing about? */
  triggerSyncing: function() {
    this.trigger('syncStatusChange', 'syncing');
  },

  triggerSyncError: function() {
    this.trigger('syncStatusChange', 'syncerror');
  },

  parse: function (message) {
    if (message.sent) {
      message.sent = moment(message.sent, moment.defaultFormat);
    }

    if (message.editedAt) {
      message.editedAt = moment(message.editedAt, moment.defaultFormat);
    }

    // Check for the special case of messages from the current user
    if (message.unread && message.fromUser) {
      if (message.fromUser.id === userId) {
        message.unread = false;
      }
    }

    return message;
  },
  toJSON: function() {
    var d = _.clone(this.attributes);
    var sent = this.get('sent');
    if(sent) {
      // Turn the moment sent value into a string
      d.sent = sent.format();
    }

    // No need to send html back to the server
    delete d.html;

    return d;
  },
  sync: SyncMixin.sync
});

var ChatCollection = LiveCollection.extend({
  model: ChatModel,
  modelName: 'chat',
  client: function() {
    return realtime.getClient();
  },
  url: apiClient.room.channelGenerator('/chatMessages'),
  comparator: function(chat1, chat2) {
    var s1 = chat1.get('sent');
    var s2 = chat2.get('sent');
    if (!s1) {
      if (!s2) return 0; // null === null
      return 1; // null > s2
    }
    if (!s2) return -1; // s1 < null
    return s1.valueOf() - s2.valueOf();
  },
  initialize: function() {
    this.listenTo(this, 'add remove', function (model, collection) {
      collection.once('sort', function () {
        burstCalculator.calc.call(this, model);
      });
    });

    this.listenTo(this, 'sync', function (model) {
      // Sync is for collections and models
      if (!(model instanceof Backbone.Model)) return;

      this.checkClientClockSkew(model);
    });

    this.listenTo(this, 'change:sent', function(model) {
      this.checkClientClockSkew(model);
    });

    this.listenTo(this, 'reset sync', function () {
      burstCalculator.parse(this);
    });

    this.resubscribeOnModelChange(context.troupe(), 'id');
  },


  parse: function (collection) {
    return burstCalculator.parse(collection);
  },

  findModelForOptimisticMerge: function (newModel) {
    var optimisticModel = this.find(function(model) {
      return !model.id && model.get('text') === newModel.get('text');
    });

    return optimisticModel;
  },

  checkClientClockSkew: function(model) {
    var sent = model.attributes.sent;
    var previousSent = model.previousAttributes().sent;

    if (sent && previousSent) {
      var diff = sent.valueOf() - previousSent.valueOf();
      if (diff > 20000) {
        log.warn('Clock skew is ' + diff + 'ms');
      }
    }
  },
  sync: SyncMixin.sync
});
cocktail.mixin(ChatCollection, InfiniteCollectionMixin);

var ReadByModel = Backbone.Model.extend({
  idAttribute: "id"
});

var ReadByCollection = LiveCollection.extend({
  model: ReadByModel,
  modelName: 'chatReadBy',
  client: function() {
    return realtime.getClient();
  },
  initialize: function(models, options) { // jshint unused:true
    var userCollection = options.userCollection;
    if(userCollection) {
      this.transformModel = function(model) {
        var m = userCollection.get(model.id);
        if(m) return m.toJSON();

        return model;
      };
    }

    var chatMessageId = options.chatMessageId;
    this.url = apiClient.room.channelGenerator("/chatMessages/" + chatMessageId + "/readBy");
  },
  sync: SyncMixin.sync
});

module.exports = {
  ReadByModel: ReadByModel,
  ReadByCollection: ReadByCollection,
  ChatModel: ChatModel,
  ChatCollection: ChatCollection
};
