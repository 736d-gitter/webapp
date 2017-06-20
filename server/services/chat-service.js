/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var env           = require('../utils/env');
var stats         = env.stats;

var persistence   = require("./persistence-service");
var collections   = require("../utils/collections");
var troupeService = require("./troupe-service");
var userService   = require("./user-service");
var unsafeHtml    = require('../utils/unsafe-html');
var processChat   = require('../utils/process-chat');
var appEvents     = require('../app-events');
var Q             = require('q');
var mongoUtils    = require('../utils/mongo-utils');
var moment        = require('moment');
var StatusError   = require('statuserror');

/*
 * Hey Trouper!
 * Bump the version if you modify the behaviour of TwitterText.
 */
var VERSION_INITIAL; /* = undefined; All previous versions are null due to a bug */
var VERSION_SWITCH_TO_SERVER_SIDE_RENDERING = 5;
var MAX_CHAT_MESSAGE_LENGTH = 4096;

var CURRENT_META_DATA_VERSION = VERSION_SWITCH_TO_SERVER_SIDE_RENDERING;

/* @const */
var MAX_CHAT_EDIT_AGE_SECONDS = 300;

var ObjectID = require('mongodb').ObjectID;

/**
 * Create a new chat and return a promise of the chat
 */
exports.newChatMessageToTroupe = function(troupe, user, data, callback) {
  return Q.fcall(function() {
    if(!troupe) throw 404;

    /* You have to have text */
    if(!data.text && data.text !== "" /* Allow empty strings for now */) throw new StatusError(400, 'Text is required');
    if(data.text.length > MAX_CHAT_MESSAGE_LENGTH) throw new StatusError(400, 'Message exceeds maximum size');

    if(!troupeService.userHasAccessToTroupe(user, troupe)) throw new StatusError(403, 'Access denied');

    // TODO: validate message
    var parsedMessage = processChat(data.text);

    var chatMessage = new persistence.ChatMessage({
      fromUserId: user.id,
      toTroupeId: troupe.id,
      sent: new Date(),
      text: data.text,                // Keep the raw message.
      status: data.status,            // Checks if it is a status update
      html: parsedMessage.html
    });

    /* Look through the mentions and attempt to tie the mentions to userIds */
    var mentionUserNames = parsedMessage.mentions.map(function(mention) {
      return mention.screenName;
    });

    return userService.findByUsernames(mentionUserNames)
      .then(function(users) {
      var usersIndexed = collections.indexByProperty(users, 'username');

      var mentions = parsedMessage.mentions.map(function(mention) {
        var user = usersIndexed[mention.screenName];
        var userId = user && user.id;

        return {
          screenName: mention.screenName,
          userId: userId
        };
      });

      // Metadata
      chatMessage.urls      = parsedMessage.urls;
      chatMessage.mentions  = mentions;
      chatMessage.issues    = parsedMessage.issues;
      chatMessage._md       = CURRENT_META_DATA_VERSION;

      return chatMessage.saveQ()
        .then(function() {

          // setTimeout(function() {
          //   troupe.users.forEach(function(troupeUser) {
          //     require('./unread-item-service').markItemsRead(troupeUser.userId, troupe.id, [chatMessage.id], [], { member: true });
          //   });

          // }, 100);

          stats.event("new_chat", {
            userId: user.id,
            troupeId: troupe.id,
            username: user.username
          });


          var _msg;
          if (troupe.oneToOne) {
            var toUserId;
            troupe.users.forEach(function(_user) {
              if (_user.userId.toString() !== user.id.toString()) toUserId = _user.userId;
            });
            _msg = {oneToOne: true, username: user.username, toUserId: toUserId, text: data.text, id: chatMessage.id, toTroupeId: troupe.id };
          } else {
            _msg = {oneToOne: false, username: user.username, room: troupe.uri, text: data.text, id: chatMessage.id, toTroupeId: troupe.id };
          }

          appEvents.chatMessage(_msg);

          return chatMessage;
        });

    });
  })
  .nodeify(callback);




};

exports.updateChatMessage = function(troupe, chatMessage, user, newText, callback) {
  var age = (Date.now() - chatMessage.sent.valueOf()) / 1000;
  if(age > MAX_CHAT_EDIT_AGE_SECONDS) {
    return callback("You can no longer edit this message");
  }

  if(chatMessage.toTroupeId != troupe.id) {
    return callback("Permission to edit this chat message is denied.");
  }

  if(chatMessage.fromUserId != user.id) {
    return callback("Permission to edit this chat message is denied.");
  }

  // If the user has been kicked out of the troupe...
  if(!troupeService.userHasAccessToTroupe(user, troupe)) {
    return callback("Permission to edit this chat message is denied.");
  }

  chatMessage.text = newText;

  var parsedMessage = processChat(newText);
  chatMessage.html  = parsedMessage.html;


  chatMessage.editedAt = new Date();

  // Metadata
  chatMessage.urls      = parsedMessage.urls;
  chatMessage.mentions  = parsedMessage.mentions;
  chatMessage.issues    = parsedMessage.issues;
  chatMessage._md       = CURRENT_META_DATA_VERSION;

  chatMessage.save(function(err) {
    if(err) return callback(err);

    return callback(null, chatMessage);
  });
};

exports.findById = function(id, callback) {
  persistence.ChatMessage.findById(id, function(err, chatMessage) {
    callback(err, chatMessage);
  });
};

 exports.findByIds = function(ids, callback) {
  if(!ids || !ids.length) return callback(null, []);

  persistence.ChatMessage
    .where('_id')['in'](collections.idsIn(ids))
    .exec(callback);
};

function massageMessages(message) {
  if('html' in message && 'text' in message) {

    if(message._md == VERSION_INITIAL) {
      var text = unsafeHtml(message.text);
      var d = processChat(text);

      message.text      = text;
      message.html      = d.html;
      message.urls      = d.urls;
      message.mentions  = d.mentions;
      message.issues    = d.issues;
    }
  }

  return message;
}

exports.findChatMessagesForTroupe = function(troupeId, options, callback) {
  var q = persistence.ChatMessage
    .where('toTroupeId', troupeId);

  if(options.startId) {
    var startId = new ObjectID(options.startId);
    q = q.where('_id').gte(startId);
  }

  if(options.beforeId) {
    var beforeId = new ObjectID(options.beforeId);
    q = q.where('_id').lt(beforeId);
  }

  q.sort(options.sort || { sent: 'desc' })
    .limit(options.limit || 50)
    .skip(options.skip || 0)
    .exec(function(err, results) {
      if(err) return callback(err);

      return callback(null, results.map(massageMessages).reverse());
    });
};

exports.findChatMessagesForTroupeForDateRange = function(troupeId, startDate, endDate, callback) {
  return persistence.ChatMessage.find({
    $and: [
      { toTroupeId: troupeId },
      { sent: { $gte: startDate}  },
      { sent: { $lte: endDate}  },
    ]
  }).sort({ sent: 'asc' })
    .execQ().then(function(results) {
      return results.map(massageMessages);
    })
    .nodeify(callback);
};

exports.findDatesForChatMessages = function(troupeId, callback) {
  return persistence.ChatMessage.aggregateQ([
    { $match: { toTroupeId: mongoUtils.asObjectID(troupeId) } },
    { $project: {
        _id: 0,
        sent: 1
      }
    },
    { $group: {
        _id: 1,
        dates: {
          $addToSet: {
            $add: [
              { $multiply: [{ $year: '$sent' }, 10000] },
              { $multiply: [{ $month: '$sent' }, 100] },
              { $dayOfMonth: '$sent' }
            ]
          }
        }
      }
    },
    { $project: {
        _id: 0,
        dates: 1
      }
    },
    {
      $unwind: "$dates"
    }
  ])
  .then(function(dates) {
    return dates.map(function(d) {
      return moment.utc("" + d.dates,  "YYYYMMDD");
    });
  })
  .nodeify(callback);
};

exports.findDailyChatActivityForRoom = function(troupeId, start, end, callback) {
  return persistence.ChatMessage.aggregateQ([
    { $match: {
        toTroupeId: mongoUtils.asObjectID(troupeId),
        sent: {
          $gte: start,
          $lte: end
        }
      }
    },
    { $project: {
        _id: 0,
        sent: 1
      }
    },
    { $group: {
        _id: {
            $add: [
              { $multiply: [{ $year: '$sent' }, 10000] },
              { $multiply: [{ $month: '$sent' }, 100] },
              { $dayOfMonth: '$sent' }
            ]
        },
        count: {
          $sum: 1
        }
      }
    }

  ])
  .then(function(dates) {
    return dates.reduce(function(memo, value) {
      memo[value._id] = value.count;
      return memo;
    }, {});
  })
  .nodeify(callback);
};
