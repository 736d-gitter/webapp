#!/usr/bin/env node
/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var mongoUtils = require('../../server/utils/mongo-utils');
var collections = require('../../server/utils/collections');
var persistenceService = require('../../server/services/persistence-service');
var userService = require('../../server/services/user-service');
var troupeService = require('../../server/services/troupe-service');
var emailNotificationService = require('../../server/services/email-notification-service');
var Q = require('q');

var logger = require('../../server/utils/env').logger;

// @const
var REMINDER_DAYS = 3;
var DAY = 1000 * 60 * 60 * 24;

// if something goes terribly wrong use this
function die(err) {
  logger.error('Catastrophic error: ' + err,  { exception: err });
  process.exit(1);
}

// gets a list of invitees and room ids, returns an array containing: [ users (Array), invitees (Array), rooms (Array)].
function mapInviteesAndRooms(users) {
  var invitees = [];
  var rooms = [];

  users.forEach(function (user) {
    invitees.push(user.invitedByUser);
    rooms.push(user.invitedToRoom);
  });

  return [users, invitees, rooms];
}

// fetches the invitees and rooms from database
function populate(users, invitees, rooms) {
  return Q.all([
    users,
    userService.findByIds(invitees),
    troupeService.findByIds(rooms)
  ]);
}

function markAsReminded(user) {
  user.inviteReminderSent = new Date();
  return user.saveQ().catch(die); // This seems a bit nasty?
}

// run the script
persistenceService.User
  .findQ({ state: 'INVITED', _id: { $lt: mongoUtils.createIdForTimestamp(Date.now() - REMINDER_DAYS * DAY) }, inviteReminderSent: { $exists: false }, invitedByUser: { $exists: true }, invitedToRoom: { $exists: true } })
  .then(function (users) { console.log(users); return users; })
  .then(mapInviteesAndRooms)
  .spread(populate)
  .spread(function (users, invitees, rooms) {
    logger.info('attempting to sent reminder to ' + users.length + ' user(s)');
    invitees = collections.indexById(invitees);
    rooms = collections.indexById(rooms);

    return Q.all(users.map(function (user) {
      var fromUser = invitees[user.invitedByUser];
      var room = rooms[user.invitedToRoom];
      return emailNotificationService.sendInvitationReminder(fromUser, user, room)
        .then(function(x) {
          return x;
        })
        .then(markAsReminded.bind(null, user))
        .catch(function (err) {
          logger.error('Couldn\'t notify user: ', user.displayName, ' id ->', user._id);
          logger.error(err);
        });
    }));
  })
  .then(function (users) {
    logger.info('invitation reminder sent to ' + users.length + ' user(s)');
    logger.info('exiting...');
    process.exit();
  })
  .catch(die);
