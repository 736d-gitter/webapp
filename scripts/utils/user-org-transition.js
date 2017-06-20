#!/usr/bin/env node
/*jslint node: true */
"use strict";

var shutdown = require('shutdown');
var Q = require('q');
var userRemovalService = require('../../server/services/user-removal-service');
var roomService = require('../../server/services/room-service');
var userService = require('../../server/services/user-service');
var persistence = require('../../server/services/persistence-service');
var uriLookupService = require('../../server/services/uri-lookup-service');
var winston = require('../../server/utils/winston');
var validateUri = require('gitter-web-github').GitHubUriValidator;
var permissionsModel   = require('../../server/services/permissions-model');

var opts = require("nomnom")
   .option('username', {
      required: true,
      help: 'Username of the user to make into an org'
   })
   .option('first-user', {
      required: true,
      help: 'User to add to the org room'
   })
   .option('dry-run', {
     flag: true,
     abbr: 'd',
     help: 'Just show the users who will be affected'
   })
   .parse();

require('../../server/services/kue-workers').startWorkers();
require('../../server/event-listeners').install();

function performUserToOrgTransition(usernameForConversion, firstUserUsername, dryRun) {
  var context = {};

  /* Find the old user and the new org */
  return Q.all([userService.findByUsername(usernameForConversion), userService.findByUsername(firstUserUsername)])
    .spread(function(userForConversion, firstUser) {
      if (!firstUser) throw new Error('Not found: ' + firstUserUsername);
      context.userForConversion = userForConversion;
      context.firstUser = firstUser;
      return [validateUri(firstUser, usernameForConversion), permissionsModel(firstUser, 'create', usernameForConversion, 'ORG', null)];
    })
    .spread(function(githubInfo, hasAccess) {
      /* Remove the user */
      if (!githubInfo) throw new Error('Not found: github uri: ' + usernameForConversion);
      if (githubInfo.type !== 'ORG') throw new Error('Github uri is not an ORG: ' + usernameForConversion);
      if (!hasAccess) throw new Error('User ' + firstUserUsername + ' does not have access to ' + usernameForConversion);

      if (dryRun) return;
      return userRemovalService.removeByUsername(usernameForConversion, { deleteUser: true });
    })
    .then(function() {
      /* Remove URI lookup */
      if (dryRun) return;
      return uriLookupService.removeBadUri(usernameForConversion);
    })
    .then(function() {
      /* Create the org room */
      if (dryRun) return;
      return roomService.findOrCreateRoom(context.firstUser, usernameForConversion);
    })
    .then(function(findOrCreateResult) {
      /* Find all child orgs */
      if (findOrCreateResult && findOrCreateResult.troupe) {
        context.newOrgRoom = findOrCreateResult.troupe;
      } else {
        if (!dryRun) throw new Error('Unable to create room');
      }

      var orQuery = [{
        lcOwner: usernameForConversion.toLowerCase(),
        githubType: 'USER_CHANNEL'
      }];

      if (context.userForConversion) {
        orQuery.push({ ownerUserId: context.userForConversion._id });
      }

      return persistence.Troupe.findQ({ $or: orQuery });
    })
    .then(function(troupesForUpdate) {
      /* Update the org rooms */
      troupesForUpdate.forEach(function(t) {
        if (t.githubType !== 'USER_CHANNEL') {
          throw new Error('Unexpected githubType type ' + t.githubType);
        }
      });

      return Q.all(troupesForUpdate.map(function(t) {
        t.githubType = 'ORG_CHANNEL';
        console.log(t.uri);

        if (dryRun) return;
        delete t.ownerUserId;
        t.parentId = context.newOrgRoom._id;

        return t.saveQ();
      }));
    });

}

performUserToOrgTransition(opts.username, opts['first-user'], opts['dry-run'])
  .delay(5000)
  .then(function() {
    shutdown.shutdownGracefully();
  })
  .catch(function(err) {
    console.error('Error: ' + err, err.stack);
    shutdown.shutdownGracefully(1);
  })
  .done();
