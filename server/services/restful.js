/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var troupeService       = require("./troupe-service");

var fileService         = require("./file-service");
var restSerializer      = require("../serializers/rest-serializer");
var winston             = require('winston');
var unreadItemService   = require("./unread-item-service");
var fileService         = require("./file-service");
var chatService         = require("./chat-service");
var conversationService = require("./conversation-service");
var recentRoomService   = require("./recent-room-service");
var eventService        = require("./event-service");
var Q                   = require('q');

exports.serializeTroupesForUser = function(userId, callback) {
    troupeService.findAllTroupesForUser(userId, function(err, troupes) {
      if (err) return callback(err);

      var strategy = new restSerializer.TroupeStrategy({ currentUserId: userId });

      restSerializer.serialize(troupes, strategy, callback);
    });
};

exports.serializeRequestsForTroupe = function(troupeId, userId, callback) {

  troupeService.findAllOutstandingRequestsForTroupe(troupeId, function(err, requests) {
    if(err) return callback(err);

    var strategy = new restSerializer.RequestStrategy({ currentUserId: userId, troupeId: troupeId });
    restSerializer.serialize(requests, strategy, callback);
  });



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

  function serializeChats(err, chatMessages) {
    if(err) return callback(err);

    var strategy = new restSerializer.ChatStrategy({ currentUserId: userId, troupeId: troupeId });
    restSerializer.serialize(chatMessages, strategy, callback);
  }

  if(options.limit) {
    chatService.findChatMessagesForTroupe(troupeId, { skip: options.skip || 0, limit: options.limit, sort: options.sort }, serializeChats);
    return d;
  }

  unreadItemService.getFirstUnreadItem(userId, troupeId, 'chat', function(err, firstId, totalUnreadItems) {
    if(firstId) {
      if(totalUnreadItems > 200) {
        chatService.findChatMessagesForTroupe(troupeId, { skip: 0, limit: 20 }, serializeChats);
        return;
      }

      // No first Id, just return the most recent 20 messages
      chatService.findChatMessagesForTroupe(troupeId, { startId: firstId }, function(err, chatMessages) {
        if(err) return callback(err);

        // Just get the last 20 messages instead
        if(chatMessages.length < 20) {
          chatService.findChatMessagesForTroupe(troupeId, { skip: 0, limit: 20 }, serializeChats);
          return;
        }

        return serializeChats(err, chatMessages);

      });

      return;
    }

    // No first Id, just return the most recent 20 messages
    chatService.findChatMessagesForTroupe(troupeId, { skip: 0, limit: 20 }, serializeChats);

  });

  return d;
};

exports.serializeFilesForTroupe = function(troupeId, userId, callback) {
  fileService.findByTroupe(troupeId, function(err, files) {
    if (err) {
      winston.error("Error in findByTroupe: ", { exception: err });
      return callback(err);
    }

    var strategy = new restSerializer.FileStrategy({ currentUserId: userId, troupeId: troupeId });
    restSerializer.serialize(files, strategy, callback);
  });
};

exports.serializeConversationsForTroupe = function(troupeId, userId, callback) {
  conversationService.findByTroupe(troupeId, function(err, conversations) {
    if(err) return callback(err);

    restSerializer.serialize(conversations, new restSerializer.ConversationMinStrategy(), callback);
  });
};

exports.serializeUsersForTroupe = function(troupeId, userId, callback) {
  troupeService.findUserIdsForTroupe(troupeId, function(err, userIds) {
    if(err) return callback(err);

    var strategy = new restSerializer.UserIdStrategy({
      showPresenceForTroupeId: troupeId,
      includeRolesForTroupeId: troupeId,
      currentUserId: userId
    });

    restSerializer.serialize(userIds, strategy, function(err, results) {
      if(err) return callback(err);
      callback(null, results.filter(function(f) { return !!f; }));
    });
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

exports.serializeRecentRoomsForUser = function(userId, callback) {
  return recentRoomService.generateRoomListForUser(userId)
    .then(function(rooms) {
      var strategy = new restSerializer.TroupeStrategy({ currentUserId: userId });

      return restSerializer.serializeQ(rooms, strategy);
    })
    .nodeify(callback);

};

exports.serializeEventsForTroupe = function(troupeId, userId, callback) {
  eventService.findEventsForTroupe(troupeId, {}, function(err, events) {
    var strategy = new restSerializer.EventStrategy({ currentUserId: userId, troupeId: troupeId });
    restSerializer.serialize(events, strategy, callback);
  });
};
