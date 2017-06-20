/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var troupeService       = require("./troupe-service");
var inviteService       = require("./invite-service");

var fileService         = require("./file-service");
var restSerializer      = require("../serializers/rest-serializer");
var winston             = require('winston');
var unreadItemService   = require("../services/unread-item-service");
var fileService         = require("../services/file-service");
var chatService         = require("../services/chat-service");
var conversationService = require("../services/conversation-service");

// USEFUL function for testing
// function slow(cb) {
//   return function(e,r) {
//     setTimeout(function() {
//       console.log('SENDING things BACK SLOWLY', r);
//       cb(e,r);
//     }, 3000);
//   };
// }


exports.serializeTroupesForUser = function(userId, callback) {
    troupeService.findAllTroupesForUser(userId, function(err, troupes) {
      if (err) return callback(err);

      var strategy = new restSerializer.TroupeStrategy({ currentUserId: userId });

      restSerializer.serialize(troupes, strategy, callback);
    });
};

exports.serializeInvitesForUser = function(userId, callback) {

  inviteService.findAllUnusedInvitesForUserId(userId, function(err, invites) {
    if(err) return callback(err);

    var strategy = new restSerializer.InviteStrategy({ currentUserId: userId });

    restSerializer.serialize(invites, strategy, callback);

  });


};

exports.serializeInvitesFromUser = function(userId, callback) {

  inviteService.findAllUnusedConnectionInvitesFromUserId(userId, function(err, invites) {
    if(err) return callback(err);

    var strategy = new restSerializer.InviteStrategy({ currentUserId: userId });

    restSerializer.serialize(invites, strategy, callback);

  });

};

exports.serializeInvitesForTroupe = function(troupeId, userId, callback) {

  inviteService.findAllUnusedInvitesForTroupe(troupeId, function(err, invites) {
    if(err) return callback(err);

    var strategy = new restSerializer.InviteStrategy({ currentUserId: userId });

    restSerializer.serialize(invites, strategy, callback);

  });

};

exports.serializeRequestsForTroupe = function(troupeId, userId, callback) {

  troupeService.findAllOutstandingRequestsForTroupe(troupeId, function(err, requests) {
    if(err) return callback(err);

    var strategy = new restSerializer.RequestStrategy({ currentUserId: userId, troupeId: troupeId });
    restSerializer.serialize(requests, strategy, callback);
  });



};

exports.serializeChatsForTroupe = function(troupeId, userId, callback) {
  function serializeChats(err, chatMessages) {
    if(err) return callback(err);

    var strategy = new restSerializer.ChatStrategy({ currentUserId: userId, troupeId: troupeId });
    restSerializer.serialize(chatMessages, strategy, callback);
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

    var strategy = new restSerializer.UserIdStrategy( { showPresenceForTroupeId: troupeId });
    restSerializer.serialize(userIds, strategy, callback);
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
