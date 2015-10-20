"use strict";
var env                       = require('gitter-web-env');
var stats                     = env.stats;
var recentRoomService         = require('./recent-room-service');
var userTroupeSettingsService = require('./user-troupe-settings-service');
var unreadItemService         = require('./unread-item-service');
var Q                         = require('q');
var qlimit                    = require('qlimit');
var roomMembershipService     = require('./room-membership-service');

/**
 * Returns a list of users who could be lurked
 * [{ userId: ..., lastAccessTime: ..., lurk: ..., notificationSettings: ... }]
 */
function findLurkCandidates(troupe, options) {
  var troupeId = troupe._id;

  return roomMembershipService.findMembersForRoomWithLurk(troupeId)
    .then(function(lurkStatus) {
      var userIds = Object.keys(lurkStatus);
      var minTimeInDays = (options.minTimeInDays || 14);

      return recentRoomService.findLastAccessTimesForUsersInRoom(troupeId, userIds)
        .then(function(lastAccessDates) {
          var cutoff = Date.now() - minTimeInDays * 86400000;

          var oldUserIds = Object.keys(lastAccessDates).map(function(userId) {
              var lastAccess = lastAccessDates[userId];

              if (lastAccess && lastAccess < cutoff) {
                return userId;
              }
            }).filter(function(f) {
              return !!f;
            });

          return [
            oldUserIds,
            lurkStatus,
            userTroupeSettingsService.getUserTroupeSettingsForUsersInTroupe(troupeId, 'notifications', oldUserIds),
            lastAccessDates
          ];
        });
    })
    .spread(function(oldUsersIds, lurkStatus, settings, lastAccessDates) {

      return oldUsersIds
        .filter(function(userId) {
          var notificationSettings = settings[userId];
          var push = notificationSettings && notificationSettings.push;
          var isLurking = lurkStatus[userId];

          return !isLurking || (push !== 'mute' && push !== 'mention');
        })
        .map(function(userId) {
          var notificationSettings = settings[userId];
          var isLurking = lurkStatus[userId];

          return {
            userId: userId,
            notificationSettings: notificationSettings && notificationSettings.push,
            lurk: isLurking,
            lastAccessTime: lastAccessDates[userId]
          };
        });
    });
}

exports.findLurkCandidates = findLurkCandidates;


var bulkUnreadItemLimit = qlimit(5);
/**
 * Bulk lurk users without putting undue strain on mongodb
 */
function bulkLurkUsers(troupeId, userIds) {
  return roomMembershipService.setMembersLurkStatus(troupeId, userIds, true)
    .then(function() {
      return Q.all(userIds.map(bulkUnreadItemLimit(function(userId) {
        return unreadItemService.ensureAllItemsRead(userId, troupeId);
      })));
    })
    .then(function() {
      userIds.forEach(function(userId) {
        stats.event("lurk_room", {
          userId: userId,
          troupeId: troupeId,
          lurking: true,
          auto: true
        });
      });
    });

    // Odd, user not found
    // if(!count) return;

    // Don't send updates for now
    //appEvents.userTroupeLurkModeChange({ userId: userId, troupeId: troupeId, lurk: lurk });
    // TODO: in future get rid of this but this collection is used by the native clients
    //appEvents.dataChange2('/user/' + userId + '/rooms', 'patch', { id: troupeId, lurk: lurk });

    // Delete all the chats in Redis for this person too
}
exports.bulkLurkUsers = bulkLurkUsers;


/**
 * Auto lurk users in a room
 */
function autoLurkInactiveUsers(troupe, options) {
  return findLurkCandidates(troupe, options)
    .then(function(candidates) {
      if (!candidates.length) return [];

      var usersToLurk = candidates
        .filter(function(candidate) {
          return !candidate.lurk;
        })
        .map(function(candidate) {
          return candidate.userId;
        });

      var usersToChangeSettings = candidates
        .filter(function(candidate) {
          return candidate.notificationSettings !== 'mute' && candidate.notificationSettings !== 'mention';
        })
        .map(function(candidate) {
          return candidate.userId;
        });

      return Q.all([
        usersToChangeSettings.length && userTroupeSettingsService.setUserSettingsForUsersInTroupe(troupe.id, usersToChangeSettings, 'notifications', { push: 'mention' }),
        usersToLurk.length && bulkLurkUsers(troupe.id, usersToLurk)
      ]).thenResolve(candidates);
    });
}
exports.autoLurkInactiveUsers = autoLurkInactiveUsers;