/*jshint strict:true, undef:true, unused:strict, browser:true *//* global define:false */
define([
  'underscore',
  'utils/context',
  './base',
  '../utils/momentWrapper'
], function(_, context, TroupeCollections, moment) {
  "use strict";

  var exports = {};

  exports.ChatModel = TroupeCollections.Model.extend({
    idAttribute: "id",
    parse: function(message) {
      if(message.sent) {
        message.sent = moment(message.sent, moment.defaultFormat);
      }

      if(message.editedAt) {
        message.editedAt = moment(message.editedAt, moment.defaultFormat);
      }

      // Check for the special case of messages from the current user
      if(message.unread && message.fromUser) {
        if(message.fromUser.id === context.getUserId()) {
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
      return d;
    }

  });

  exports.ChatCollection = TroupeCollections.LiveCollection.extend({
    model: exports.ChatModel,
    modelName: 'chat',
    nestedUrl: "chatMessages",
    preloadKey: "chatMessages",
    sortByMethods: {
      'sent': function(chat) {
        var offset = chat.id ? 0 : 300000;

        var sent = chat.get('sent');

        if(!sent) return offset;
        return sent.valueOf() + offset;
      }
    },

    initialize: function() {
      this.setSortBy('sent');
    },

    findModelForOptimisticMerge: function(newModel) {
      var optimisticModel = this.find(function(model) {
        return !model.id && model.get('text') === newModel.get('text');
      });

      return optimisticModel;
    }
  });
  _.extend(exports.ChatCollection.prototype, TroupeCollections.ReversableCollectionBehaviour);

  exports.ReadByModel = TroupeCollections.Model.extend({
    idAttribute: "id"
  });

  exports.ReadByCollection = TroupeCollections.LiveCollection.extend({
    model: exports.ReadByModel,
    modelName: 'chatReadBy',
    initialize: function(models, options) {
      var userCollection = options.userCollection;
      if(userCollection) {
        this.transformModel = function(model) {
          var m = userCollection.get(model.id);
          if(m) return m.toJSON();

          return model;
        };
      }

      this.chatMessageId = options.chatMessageId;
      this.url = "/troupes/" + context.getTroupeId() + "/chatMessages/" + this.chatMessageId + "/readBy";
    }
  });

  return exports;
});
