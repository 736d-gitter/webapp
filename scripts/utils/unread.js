#!/usr/bin/env node
/*jslint node:true, unused:true */
"use strict";

var userService = require('../../server/services/user-service');
var troupeService = require('../../server/services/troupe-service');
var troupeUriMapper = require('../../server/services/troupe-uri-mapper');
var unreadService = require('../../server/services/unread-item-service');
var restful = require("../../server/services/restful");

var shutdown = require('shutdown');

var opts = require("nomnom").option('username', {
  position: 0,
  required: true,
  help: "username to look up e.g trevorah"
}).parse();

function getBadgeCount(userId) {
  return unreadService.getBadgeCountsForUserIds([userId])
    .then(function(badgeHash) {
      return badgeHash[userId];
    });
}

function getBadgeTroupeNames(userId) {
  return unreadService.testOnly.getTroupeIdsCausingBadgeCount(userId)
    .then(function(troupeIds) {
      return getNamesForTroupeIds(troupeIds, userId);
    });
}

function getLeftMenuUnreadTroupeNames(userId) {
  return restful.serializeTroupesForUser(userId)
    .then(function(rooms) {
      return rooms.filter(function(room) {
        return room.unreadItems || room.mentions;
      }).map(function(room) {
        return room.name;
      });
    });
}

function getNamesForTroupeIds(troupeIds, userId) {
  return troupeService.findByIds(troupeIds)
    .then(function(troupes) {
      return troupes.map(function(troupe) {
        return troupeUriMapper.getUrlForTroupeForUserId(troupe, userId);
      });
    }).all();
}

userService.findByUsername(opts.username)
  .then(function(user) {
    return user._id;
  })
  .then(function(userId) {
    return [getBadgeCount(userId), getBadgeTroupeNames(userId), getLeftMenuUnreadTroupeNames(userId)];
  })
  .spread(function(badgeNumber, badgeTroupeNames, leftMenuUnreadTroupeNames) {
    console.log('Unread badge number:', badgeNumber);
    console.log('Rooms causing badge number:', badgeTroupeNames);
    console.log('Left menu unread rooms:', leftMenuUnreadTroupeNames);
  })
  .delay(1000)
  .catch(function(err) {
    console.error(err.stack);
  })
  .finally(function() {
    shutdown.shutdownGracefully();
  });
