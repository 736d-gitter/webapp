/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var troupeService       = require("./troupe-service");

var restSerializer      = require("../serializers/rest-serializer");
var unreadItemService   = require("./unread-item-service");
var chatService         = require("./chat-service");
var eventService        = require("./event-service");
var Q                   = require('q');
var roomService         = require('./room-service');

var DEFAULT_CHAT_COUNT_LIMIT = 30;

exports.serializeTroupesForUser = function(userId, callback) {
  return roomService.findAllRoomsIdsForUserIncludingMentions(userId)
    .then(function(troupeIds) {
      var strategy = new restSerializer.TroupeIdStrategy({ currentUserId: userId });

      return restSerializer.serializeQ(troupeIds, strategy);
    })
    .nodeify(callback);
};

exports.serializeChatsForTroupe = function(troupeId, userId, options, cb) {
  if(typeof options == 'function' && typeof cb == 'undefined') {
    cb = options;
    options = {};
  }

  if(!options) options = {};

  var d = Q.defer();
  var callback = d.makeNodeResolver();
  d = d.promise.nodeify(cb);

  chatService.findChatMessagesForTroupe(troupeId, { skip: options.skip || 0, limit: options.limit || DEFAULT_CHAT_COUNT_LIMIT, sort: options.sort }, function(err, chatMessages) {
    if(err) return callback(err);

    var strategy = new restSerializer.ChatStrategy({ currentUserId: userId, troupeId: troupeId });
    restSerializer.serialize(chatMessages, strategy, callback);
  });

  return d;
};

exports.serializeUsersForTroupe = function(troupeId, userId, callback) {
  troupeService.findUserIdsForTroupe(troupeId, function(err, userIds) {
    if(err) return callback(err);

    var strategy = new restSerializer.UserIdStrategy({
      showPresenceForTroupeId: troupeId,
      includeRolesForTroupeId: troupeId,
      currentUserId: userId
    });

    restSerializer.serializeExcludeNulls(userIds, strategy, callback);
  });
};

exports.serializeUnreadItemsForTroupe = function(troupeId, userId, callback) {
  unreadItemService.getUnreadItemsForUser(userId, troupeId, callback);
};

exports.serializeReadBysForChat = function(troupeId, chatId, callback) {
  chatService.findById(chatId, function(err, chatMessage) {
    if(err) return callback(err);
    var strategy = new restSerializer.UserIdStrategy({});

    restSerializer.serialize(chatMessage.readBy, strategy, function(err, serialized) {
      if(err) return callback(err);
      callback(null, serialized);
    });

  });

};

exports.serializeEventsForTroupe = function(troupeId, userId, callback) {
  eventService.findEventsForTroupe(troupeId, {}, function(err, events) {
    var strategy = new restSerializer.EventStrategy({ currentUserId: userId, troupeId: troupeId });
    restSerializer.serialize(events, strategy, callback);
  });
};
