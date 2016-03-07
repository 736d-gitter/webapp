#!/usr/bin/env node
/*jslint node:true, unused:true */
"use strict";

var userService = require('../../server/services/user-service');
var troupeService = require('../../server/services/troupe-service');
var unreadItemService = require('../../server/services/unread-item-service');
var collections = require('../../server/utils/collections');
var categoriseUsersInRoom = require('../../server/services/categorise-users-in-room');
var Promise = require('bluebird');

var shutdown = require('shutdown');


var opts = require('yargs')
  .option('uri', {
    description: "uri of room to list presence for"
  })
  .option('fromUser', {
    description: "id of room to list presence for"
  })
  .option('toUser', {
    description: "id of room to list presence for"
  })
  .argv;

function getTroupe() {
  if (opts.uri)
    return troupeService.findByUri(opts.uri);

  if (!opts.fromUser || !opts.toUser) {
    return Promise.reject('Please specify either a uri or a fromUser and toUser');
  }

  return Promise.all([
    userService.findByUsername(opts.fromUser),
    userService.findByUsername(opts.toUser),
  ])
  .spread(function(fromUser, toUser) {
    if (!fromUser) throw new Error('User ' + opts.fromUser + ' not found');
    if (!toUser) throw new Error('User ' + opts.toUser + ' not found');

    return troupeService.findOneToOneTroupe(fromUser._id, toUser._id);
  });

}

getTroupe()
  .then(function(troupe) {
    if (!troupe) throw new Error('Room not found');
    return [troupe, unreadItemService.testOnly.parseChat(null, troupe)];
  })
  .spread(function(troupe, result) {
    var allUserIds = {};
    Object.keys(result).forEach(function(key) {
      var value = result[key];
      if (value) {
        value.forEach(function(userId) {
          allUserIds[userId] = 1;
        });
      }
    });

    allUserIds = Object.keys(allUserIds);
    return [troupe, userService.findByIdsLean(allUserIds, { username: 1 }), result];
  })
  .spread(function(troupe, users, result) {
    var allUserIds = result.notifyUserIds.concat(result.activityOnlyUserIds);

    return [troupe, users, result, categoriseUsersInRoom(troupe._id, allUserIds)];
  })
  .spread(function(troupe, users, result, categorised) {
    var usersHash = collections.indexById(users);

    var m = {};
    Object.keys(result).forEach(function(key) {
      var value = result[key];
      if (value) {
        m[key] = value.map(function(userId) {
          var user = usersHash[userId];
          return user && user.username;
        });
      }
    });

    console.log(m);

    console.log(Object.keys(categorised).reduce(function(memo, userId) {
      var user = usersHash[userId];
      if (user) {
        memo[user.username] = categorised[userId];
      }

      return memo;
    }, {}));
  })
  .catch(function(err) {
    console.error(err.stack);
  })
  .finally(function() {
    shutdown.shutdownGracefully();
  });
