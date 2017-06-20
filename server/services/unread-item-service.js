/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var env              = require('gitter-web-env');
var logger           = env.logger;
var errorReporter    = env.errorReporter;
var engine           = require('./unread-item-service-engine');
var readByService    = require("./readby-service");
var userService      = require("./user-service");
var roomPermissionsModel = require('./room-permissions-model');
var appEvents        = require('gitter-web-appevents');
var categoriseUserInRoom  = require("./categorise-users-in-room");
var _                = require("lodash");
var mongoUtils       = require('../utils/mongo-utils');
var RedisBatcher     = require('../utils/redis-batcher').RedisBatcher;
var collections      = require('../utils/collections');
var Q                = require('q');
var roomMembershipService = require('./room-membership-service');
var uniqueIds        = require('mongodb-unique-ids');
var debug            = require('debug')('gitter:unread-item-service');

var badgeBatcher     = new RedisBatcher('badge', 1000, batchBadgeUpdates);

/* Handles batching badge updates to users */
function batchBadgeUpdates(key, userIds, done) {
  // Remove duplicates
  userIds = uniqueIds(userIds);

  // Get responders to respond
  appEvents.batchUserBadgeCountUpdate({
    userIds: userIds
  });

  done();
}

function sinceFilter(since) {
  var sinceObjectID = mongoUtils.createIdForTimestampString(since).toString();
  return function(id) {
    return id >= sinceObjectID;
  };
}

function reject(msg) {
  logger.error(msg);
  return Q.reject(new Error(msg));
}

/**
 * Item removed
 * @return {promise} promise of nothing
 */
function removeItem(troupeId, itemId) {
  if(!troupeId) return reject("removeItem failed. Troupe cannot be null");
  if(!itemId) return reject("removeItem failed. itemId cannot be null");

  return roomMembershipService.findMembersForRoomWithLurk(troupeId)
    .then(function(userIdsWithLurk) {
      var userIds = Object.keys(userIdsWithLurk);

      // Publish out an unread item removed event
      var data = { chat: [itemId] };

      userIds.forEach(function(userId) {
        appEvents.unreadItemsRemoved(userId, troupeId, data);
      });

      var userIdsForNotify = userIds.filter(function(u) {
        return !userIdsWithLurk[u];
      });

      return engine.removeItem(troupeId, itemId, userIdsForNotify)
        .then(function(removeResults) {
          removeResults.forEach(function(removeResult) {

            if(removeResult.unreadCount >= 0 || removeResult.mentionCount >= 0) {
              appEvents.troupeUnreadCountsChange({
                userId: removeResult.userId,
                troupeId: troupeId,
                total: removeResult.unreadCount,
                mentions: removeResult.mentionCount
              });
            }

            if (removeResult.badgeUpdate) {
              queueBadgeUpdateForUser(removeResult.userId);
            }

          });

        });

  });
}

/*
  This ensures that if all else fails, we clear out the unread items
  It should only have any effect when data is inconsistent
*/
function ensureAllItemsRead(userId, troupeId) {
  if(!userId) return reject("ensureAllItemsRead failed. userId required");
  if(!troupeId) return reject("ensureAllItemsRead failed. troupeId required");

  return engine.ensureAllItemsRead(userId, troupeId)
    .then(function(result) {

      // Notify the user
      appEvents.troupeUnreadCountsChange({
        userId: userId,
        troupeId: troupeId,
        total: 0,
        mentions: 0
      });

      if (result.badgeUpdate) {
        queueBadgeUpdateForUser(userId);
      }

    });
}
exports.ensureAllItemsRead = ensureAllItemsRead;

/**
 * Returns a hash of hash {user:troupe:ids} of users who have
 * outstanding notifications since before the specified time
 * @return a promise of hash
 */
exports.listTroupeUsersForEmailNotifications = function(horizonTime, emailLatchExpiryTimeS) {
  return engine.listTroupeUsersForEmailNotifications(horizonTime, emailLatchExpiryTimeS);
};

/**
 * Mark many items as read, for a single user and troupe
 */
exports.markItemsRead = function(userId, troupeId, itemIds, options) {
  if(!userId) return reject("userId required");
  if(!troupeId) return reject("troupeId required");

  var markAllRead = options && options.markAllRead;

  if(!markAllRead) {
    // No need to send individual notifications on markAllRead
    appEvents.unreadItemsRemoved(userId, troupeId, { chat: itemIds });
  }

  return engine.markItemsRead(userId, troupeId, itemIds)
    .then(function(result) {
      if(result.unreadCount >= 0 || result.mentionCount >= 0) {
        // Notify the user
        appEvents.troupeUnreadCountsChange({
          userId: userId,
          troupeId: troupeId,
          total: result.unreadCount,
          mentions: result.mentionCount
        });
      }

      /* Do we need to send the user a badge update? */
      if (result.badgeUpdate) {
        queueBadgeUpdateForUser(userId);
      }

      var recordAsRead = !options || options.recordAsRead === undefined ? true : options.recordAsRead;

      if(recordAsRead) {
        return readByService.recordItemsAsRead(userId, troupeId, { chat: itemIds });
      }

    });

};

exports.markAllChatsRead = function(userId, troupeId, options) {
  if(!mongoUtils.isLikeObjectId(userId)) return reject('userId must be a mongoid');
  if(!mongoUtils.isLikeObjectId(troupeId)) return reject('troupeId must be a mongoid');

  if(!options) options = {};
  appEvents.markAllRead({ userId: userId, troupeId: troupeId });

  return exports.getUnreadItems(userId, troupeId)
    .then(function(chatIds) {
      /* If we already have everything marked as read, force all read */
      if(!chatIds.length) return ensureAllItemsRead(userId, troupeId, options);

      if(!('recordAsRead' in options)) options.recordAsRead = false;

      options.markAllRead = true; // Don't send individual item read events

      /* Don't mark the items as read */
      return exports.markItemsRead(userId, troupeId, chatIds, options);
    });
};

exports.getUserUnreadCountsForTroupeIds = function(userId, troupeIds) {
  return engine.getUserUnreadCountsForRooms(userId, troupeIds);
};

exports.getUnreadItems = function(userId, troupeId) {
  return engine.getUnreadItems(userId, troupeId);
};

exports.getAllUnreadItemCounts = function(userId) {
  return engine.getAllUnreadItemCounts(userId);
};

exports.getRoomIdsMentioningUser = function(userId) {
  return engine.getRoomsMentioningUser(userId);
};

exports.getFirstUnreadItem = function(userId, troupeId) {
  return engine.getUnreadItems(userId, troupeId)
    .then(function(members) {
      return getOldestId(members);
    })
    .catch(function(err) {
      logger.warn("unreadItemService.getUnreadItems failed: " + err, { exception: err });
      return null;
    });
};

exports.getUnreadItemsForUser = function(userId, troupeId) {
  return engine.getUnreadItemsAndMentions(userId, troupeId)
    .spread(function(chats, mentions) {
      return {
        chat: chats,
        mention: mentions
      };
    });
};

/* Get unread items and mentions for a user since a particular date */
exports.getUnreadItemsForUserTroupeSince = function(userId, troupeId, since) {
  return engine.getUnreadItemsAndMentions(userId, troupeId)
    .spread(function(chats, mentions) {

      return [
        chats.filter(sinceFilter(since)),
        mentions.filter(sinceFilter(since))
      ];
    });
};


/**
 * Get the badge counts for userIds
 * @return promise of a hash { userId1: 1, userId: 2, etc }
 */
exports.getBadgeCountsForUserIds = function(userIds, callback) {
  return engine.getBadgeCountsForUserIds(userIds)
    .nodeify(callback);
};

function getOldestId(ids) {
  if(!ids.length) return null;

  return _.min(ids, function(id) {
    // Create a new ObjectID with a specific timestamp
    return mongoUtils.getTimestampFromObjectId(id);
  });
}

function getTroupeIdsCausingBadgeCount(userId) {
  return engine.getRoomsCausingBadgeCount(userId);
}

/**
 * Given an array of non-member userIds in a room,
 * returns an array of those members who have permission to access
 * the room. They will be notified. People mentions who don't
 * have access will not.
 */
function findNonMembersWithAccess(troupe, userIds) {
  if (!userIds.length || troupe.oneToOne || troupe.security === 'PRIVATE') {
    // Trivial case, and the case where only members have access to the room type
    return Q.resolve([]);
  }

  // Everyone can always access a public room
  if (troupe.security === 'PUBLIC') return Q.resolve(userIds);

  return userService.findByIds(userIds)
    .then(function(users) {
      var result = [];

      return Q.all(users.map(function(user) {
        /* TODO: some sort of bulk service here */
        return roomPermissionsModel(user, 'join', troupe)
          .then(function(access) {
            if(access) {
              result.push("" + user.id);
            }
          })
          .catch(function(e) {
            // Swallow errors here. If the call fails, the chat should not fail
            errorReporter(e, { username: user.username, operation: 'findNonMembersWithAccess' }, { module: 'unread-items' });
          });
      }))
      .then(function() {
        return result;
      });
    });
}

function parseMentions(fromUserId, troupe, userIdsWithLurk, mentions) {
  var creatorUserId = fromUserId && "" + fromUserId;

  var uniqueUserIds = {};
  mentions.forEach(function(mention) {
    if(mention.group) {
      if(mention.userIds) {
        mention.userIds.forEach(function(userId) {
          uniqueUserIds[userId] = true;
        });
      }
    } else {
      if(mention.userId) {
        uniqueUserIds[mention.userId] = true;
      }
    }
  });

  var memberUserIds = [];
  var nonMemberUserIds = [];

  Object.keys(uniqueUserIds).forEach(function(userId) {
    /* Don't be mentioning yourself yo */
    if(userId == creatorUserId) return;

    // If the user is in the room, add them to the memberUserIds list
    if(userIdsWithLurk.hasOwnProperty(userId)) {
      memberUserIds.push(userId);
      return;
    }

    // The user is not in the room, add them to the nonMembers list
    nonMemberUserIds.push(userId);
  });

  // Skip checking if there are no non-members
  if(!nonMemberUserIds.length) {
    return Q.resolve({
      memberUserIds: memberUserIds,
      nonMemberUserIds: [],
      mentionUserIds: memberUserIds
    });
  }

  /* Lookup the non-members and check if they can access the room */
  return findNonMembersWithAccess(troupe, nonMemberUserIds)
    .then(function(nonMemberUserIdsFiltered) {
      /* Mentions consists of members and non-members */
      var mentionUserIds = memberUserIds.concat(nonMemberUserIdsFiltered);

      return {
        memberUserIds: memberUserIds,
        nonMemberUserIds: nonMemberUserIdsFiltered,
        mentionUserIds: mentionUserIds
      };
    });
}

function parseChat(fromUserId, troupe, mentions) {
  return roomMembershipService.findMembersForRoomWithLurk(troupe._id)
    .then(function(userIdsWithLurk) {
      var creatorUserId = fromUserId && "" + fromUserId;

      var nonActive = [];
      var active = [];

      Object.keys(userIdsWithLurk).forEach(function(userId) {
        if (creatorUserId && userId === creatorUserId) return;

        var lurk = userIdsWithLurk[userId];

        if (lurk) {
          nonActive.push(userId);
        } else {
          active.push(userId);
        }
      });

      if(!mentions || !mentions.length) {
        return Q.resolve({
          notifyUserIds: active,
          mentionUserIds: [],
          activityOnlyUserIds: nonActive,
          notifyNewRoomUserIds: []
        });
      }

      /* Add the mentions into the mix */
      return parseMentions(fromUserId, troupe, userIdsWithLurk, mentions)
        .then(function(parsedMentions) {
          var notifyUserIdsHash = {};
          active.forEach(function(userId) { notifyUserIdsHash[userId] = 1; });
          parsedMentions.mentionUserIds.forEach(function(userId) { notifyUserIdsHash[userId] = 1; });

          var nonActiveLessMentions = nonActive.filter(function(userId) {
            return !notifyUserIdsHash[userId];
          });

          return {
            notifyUserIds: Object.keys(notifyUserIdsHash),
            mentionUserIds: parsedMentions.mentionUserIds,
            activityOnlyUserIds: nonActiveLessMentions,
            notifyNewRoomUserIds: parsedMentions.nonMemberUserIds
          };
        });

    });
}

function processResultsForNewItemWithMentions(troupeId, chatId, parsed, results, isEdit) {
  debug("distributing chat notification to users");
  var allUserIds = parsed.notifyUserIds.concat(parsed.activityOnlyUserIds);

  return categoriseUserInRoom(troupeId, allUserIds)
    .then(function(presenceStatus) {
      var mentionsHash = collections.hashArray(parsed.mentionUserIds);

      // Firstly, notify all the notifyNewRoomUserIds with room creation messages
      parsed.notifyNewRoomUserIds.forEach(function(userId) {
        appEvents.userMentionedInNonMemberRoom({ troupeId: troupeId, userId: userId });
      });

      var userIdsForOnlineNotification = [];
      var userIdsForOnlineNotificationWithMention = [];
      var pushCandidates = [];
      var pushCandidatesWithMention = [];

      var newUnreadItemNoMention = { chat: [chatId] };
      var newUnreadItemWithMention = { chat: [chatId], mention: [chatId] };

      var badgeUpdateUserIds = [];

      // Next, notify all the users with unread count changes
      parsed.notifyUserIds.forEach(function(userId) {

        var onlineStatus = presenceStatus[userId];
        var hasMention = mentionsHash[userId];

        var userResult = results[userId];

        var unreadCount;
        var mentionCount;

        if (userResult) {
          unreadCount = userResult.unreadCount;
          mentionCount = userResult.mentionCount;

          if (userResult.badgeUpdate && onlineStatus) { /* online status null implies the user has no push notification devices */
            badgeUpdateUserIds.push(userId);
          }
        }

        var connected = false;
        var push = false;
        var pushNotified = false;
        var webNotification = false;

        /* We need to do this for all users as it's used for mobile notifications */
        switch(onlineStatus) {
          case 'inroom':
            connected = true;
            break;

          case 'online':
            connected = true;
            webNotification = true;
            break;

          case 'mobile':
            connected = true;
            break;

          case 'push':
            push = true;
            break;

          case 'push_connected':
            push = true;
            connected = true;
            break;

          case 'push_notified':
            pushNotified = true;
            break;

          case 'push_notified_connected':
            pushNotified = true;
            connected = true;
            break;
        }

        if (connected) {
          var unreadItemMessage = hasMention ? newUnreadItemWithMention : newUnreadItemNoMention;
          appEvents.newUnreadItem(userId, troupeId, unreadItemMessage, true);

          if(unreadCount >= 0 || mentionCount >= 0) {
            // Notify the user
            appEvents.troupeUnreadCountsChange({
              userId: userId,
              troupeId: troupeId,
              total: unreadCount,
              mentions: mentionCount
            });
          }
        }

        /* User needs a web notification */
        if (webNotification) {
          var notificationQueue = hasMention ? userIdsForOnlineNotificationWithMention : userIdsForOnlineNotification;
          notificationQueue.push(userId);
        }

        /* User needs a push notification */
        if (push) {
          var pushNotificationQueue = hasMention ? pushCandidatesWithMention : pushCandidates;
          pushNotificationQueue.push(userId);
        }

        /* User has already received a push notification */
        if (pushNotified) {
          if (!hasMention) return; // Only notify for mention
          pushCandidatesWithMention.push(userId);
        }

      });

      if (!isEdit) {
        // Next notify all the users currently online but not in this room who
        // will receive desktop notifications
        if (userIdsForOnlineNotification.length) {
          appEvents.newOnlineNotification(troupeId, chatId, userIdsForOnlineNotification, false);
        }

        // Next notify all the users currently online but not in this room who
        // will receive desktop notifications
        if (userIdsForOnlineNotificationWithMention.length) {
          appEvents.newOnlineNotification(troupeId, chatId, userIdsForOnlineNotificationWithMention, true);
        }

        if (pushCandidatesWithMention.length) {
          appEvents.newPushNotificationForChat(troupeId, chatId, pushCandidatesWithMention, true);
        }

        if (pushCandidates.length) {
          appEvents.newPushNotificationForChat(troupeId, chatId, pushCandidates, false);
        }

        // Next, notify all the lurkers
        // Note that this can be a very long list in a big room
        var activityOnly = parsed.activityOnlyUserIds;
        for(var i = 0; i < activityOnly.length; i++) {
          var activityOnlyUserId =  activityOnly[i];
          var activityOnlyUserIdOnlineStatus = presenceStatus[activityOnlyUserId];

          /* User is connected? Send them a status update */
          switch(activityOnlyUserIdOnlineStatus) {
            case 'inroom':
            case 'online':
            case 'mobile':
            case 'push_connected':
            case 'push_notified_connected':
              appEvents.newLurkActivity({ userId: activityOnlyUserId, troupeId: troupeId });
          }
        }
      }

      /* Do we need to send the user a badge update? */
      if (badgeUpdateUserIds.length) {
        queueBadgeUpdateForUser(badgeUpdateUserIds);
      }

      debug("distribution of chat notification to users completed");

    });
}

function createChatUnreadItems(fromUserId, troupe, chat) {
  return parseChat(fromUserId, troupe, chat.mentions)
    .then(function(parsed) {
      return engine.newItemWithMentions(troupe.id, chat.id, parsed.notifyUserIds, parsed.mentionUserIds)
        .then(function(results) {
          return processResultsForNewItemWithMentions(troupe.id, chat.id, parsed, results, false);
        });
    });
}
exports.createChatUnreadItems = createChatUnreadItems;

function toString(f) {
  if (!f) return '';
  return '' + f;
}
/**
 * Given a set of original mentions and a chat message, returns
 * { addNotify: [userIds], addMentions: [userIds], remove: [userIds], addNewRoom: [userIds] }
 * Which consist of users no longer mentioned in a message and
 * new users who are now mentioned in the message, who were not
 * previously.
 */
function generateMentionDeltaSet(parsedChat, originalMentions) {
  var originalMentionUserIds = originalMentions
    .map(function(mention) {
      if(mention.userIds && mention.userIds.length) return mention.userIds;
      return mention.userId;
    })
    .filter(function(m) {
      return !!m;
    });


  /* Arg. Underscore. We need lazy evaluation! */
  originalMentionUserIds = _.flatten(originalMentionUserIds).map(toString);
  originalMentionUserIds = uniqueIds(originalMentionUserIds);

  var mentionUserIds = parsedChat.mentionUserIds.map(toString);

  var addMentions = _.without.apply(null, [mentionUserIds].concat(originalMentionUserIds));
  var removeMentions = _.without.apply(null, [originalMentionUserIds].concat(mentionUserIds));

  // List of users who should get unread items, who were previously mentioned but no longer are
  var forNotifyWithRemoveMentions = _.intersection(parsedChat.notifyUserIds.map(toString), removeMentions);

  // Everyone who was added via a mention, plus everyone who was no longer mentioned but is not lurking
  var addNotify = forNotifyWithRemoveMentions.concat(addMentions);

  // Users who are newly mentioned but not currently in the room
  var addNewRoom = _.intersection(addMentions, parsedChat.notifyNewRoomUserIds.map(toString));

  return { addNotify: addNotify, addMentions: addMentions, addNewRoom: addNewRoom, remove: removeMentions };
}

function removeMentionsForUpdatedChat(troupeId, chatId, removeUserIds) {
  return engine.removeItem(troupeId, chatId, removeUserIds)
    .then(function(results) {
      results.forEach(function(result) {
        // Remove the mention for the user
        // TODO: only for only users
        appEvents.unreadItemsRemoved(result.userId, troupeId, { mention: [chatId] });

        if(result.unreadCount >= 0 || result.mentionCount >= 0) {
          // Notify the user
          appEvents.troupeUnreadCountsChange({
            userId: result.userId,
            troupeId: troupeId,
            total: result.unreadCount,
            mentions: result.mentionCount
          });
        }

        if (result.badgeUpdate) {
          queueBadgeUpdateForUser(result.userId);
        }

      });
    });
}

/**
 * Updates the mentions for an edited message
 */
function updateChatUnreadItems(fromUserId, troupe, chat, originalMentions) {
  var troupeId = troupe.id;
  return parseChat(fromUserId, troupe, chat.mentions)
    .then(function(parsedChat) {
      var delta = generateMentionDeltaSet(parsedChat, originalMentions);

      // Remove first
      return [parsedChat, delta, delta.remove.length && removeMentionsForUpdatedChat(troupeId, chat.id, delta.remove)];
    })
    .spread(function(parsedChat, delta) {
      if (!delta.addNotify.length) return;

      // Add additional mentions
      return engine.newItemWithMentions(troupeId, chat.id, delta.addNotify, delta.addMentions, delta.addNewRoom)
        .then(function(results) {
          return processResultsForNewItemWithMentions(troupeId, chat.id, parsedChat, results, true);
        });
    });
}
exports.updateChatUnreadItems = updateChatUnreadItems;

var sendBadgeUpdates = true;
function queueBadgeUpdateForUser(userIds) {
  if (!sendBadgeUpdates) return;
  var len = Array.isArray(userIds) ? userIds.length : 1;
  debug("Batching badge update for %s users", len);
  badgeBatcher.add('queue', userIds);
}

exports.listen = function() {
  badgeBatcher.listen();
};

exports.testOnly = {
  setSendBadgeUpdates: function(value) {
    sendBadgeUpdates = value;
  },
  getOldestId: getOldestId,
  sinceFilter: sinceFilter,
  removeItem: removeItem,
  getTroupeIdsCausingBadgeCount: getTroupeIdsCausingBadgeCount,
  parseChat: parseChat,
  generateMentionDeltaSet: generateMentionDeltaSet,
  findNonMembersWithAccess: findNonMembersWithAccess
};
