/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var troupeService       = require("./troupe-service");

var restSerializer      = require("../serializers/rest-serializer");
var unreadItemService   = require("./unread-item-service");
var chatService         = require("./chat-service");
var userService         = require("./user-service");
var eventService        = require("./event-service");
var Q                   = require('q');
var roomService         = require('./room-service');
var GithubMe            = require('./github/github-me-service');
var _                   = require('underscore');

var DEFAULT_CHAT_COUNT_LIMIT = 30;

exports.serializeTroupesForUser = function(userId, callback) {
  if(!userId) return Q.resolve([]);

  return roomService.findAllRoomsIdsForUserIncludingMentions(userId)
    .then(function(troupeIds) {
      var strategy = new restSerializer.TroupeIdStrategy({
        currentUserId: userId,
        mapUsers: false
      });

      return restSerializer.serializeQ(troupeIds, strategy);
    })
    .nodeify(callback);
};

exports.serializeChatsForTroupe = function(troupeId, userId, options, callback) {
  options = _.extend({}, {
    skip: 0,
    limit: DEFAULT_CHAT_COUNT_LIMIT,
    userId: userId // This may also be appearing through in options
  }, options);

  var initialId = options.aroundId;

  return chatService.findChatMessagesForTroupe(troupeId, options)
    .spread(function(chatMessages, limitReached) {
      var strategy = new restSerializer.ChatStrategy({
        notLoggedIn: !userId,
        initialId: initialId,
        currentUserId: userId,
        troupeId: troupeId,
        limitReached: limitReached,
        unread: options.unread,
        disableLimitReachedMessage: options.disableLimitReachedMessage
      });

      return restSerializer.serialize(chatMessages, strategy);
    })
    .nodeify(callback);

};

exports.serializeUsersForTroupe = function(troupeId, userId, callback) {
  return troupeService.findUserIdsForTroupe(troupeId)
    .then(function(userIds) {
      var strategy = new restSerializer.UserIdStrategy({
        showPresenceForTroupeId: troupeId,
        includeRolesForTroupeId: troupeId,
        currentUserId: userId
      });

      return restSerializer.serializeExcludeNulls(userIds, strategy);
    })
    .nodeify(callback);
};

exports.serializeUnreadItemsForTroupe = function(troupeId, userId, callback) {
  var d = Q.defer();
  unreadItemService.getUnreadItemsForUser(userId, troupeId, d.makeNodeResolver());
  return d.promise.nodeify(callback);
};

exports.serializeReadBysForChat = function(troupeId, chatId, callback) {
  return chatService.findById(chatId)
    .then(function(chatMessage) {
      var strategy = new restSerializer.UserIdStrategy({});

      return restSerializer.serialize(chatMessage.readBy, strategy);
    })
    .nodeify(callback);

};

exports.serializeEventsForTroupe = function(troupeId, userId, callback) {
  return eventService.findEventsForTroupe(troupeId, {})
    .then(function(events) {
      var strategy = new restSerializer.EventStrategy({ currentUserId: userId, troupeId: troupeId });
      return restSerializer.serialize(events, strategy);
    })
    .nodeify(callback);
};

exports.serializeOrgsForUser = function(user, options) {
  var ghUser = new GithubMe(user);

  var strategyOptions = { currentUserId: user.id, mapUsers: options && options.mapUsers };

  return ghUser.getOrgs()
    .then(function(ghOrgs) {
      var strategy = new restSerializer.GithubOrgStrategy(strategyOptions);

      return restSerializer.serialize(ghOrgs, strategy);
    });
};

exports.serializeOrgsForUserId = function(userId, options) {
  return userService.findById(userId)
    .then(function(user) {
      if(!user) return [];

      return exports.serializeOrgsForUser(user, options);
    });
};
