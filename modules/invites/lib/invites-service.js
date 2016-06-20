'use strict';

var Promise = require('bluebird');
var TroupeInvite = require('gitter-web-persistence').TroupeInvite;
var uuid = require('node-uuid');
var assert = require('assert');
var StatusError = require('statuserror');
var mongoUtils = require('gitter-web-persistence-utils/lib/mongo-utils');

function createInvite(roomId, options) {
  var type = options.type;
  var externalId = options.externalId;
  var invitedByUserId = options.invitedByUserId;
  var emailAddress = options.emailAddress;

  externalId = externalId.toLowerCase();
  var secret = uuid.v4();
  return TroupeInvite.create({
      troupeId: roomId,
      type: type,
      externalId: externalId,
      emailAddress: emailAddress,
      userId: null,
      secret: secret,
      invitedByUserId: invitedByUserId,
      state: 'PENDING'
    })
    .catch(mongoUtils.mongoErrorWithCode(11000), function() {
      throw new StatusError(409); // Conflict
    });
}

function accept(userId, secret) {
  assert(secret);
  return TroupeInvite.findOne({ secret: String(secret) })
    .lean()
    .exec()
    .then(function(invite) {
      if (!invite) throw new StatusError(404);
      if (invite.userId) {
        // Is this user re-using the invite?
        if (!mongoUtils.objectIDsEqual(invite.userId, userId)) {
          throw new StatusError(404);
        }
      }

      return invite;
    });
}

function markInviteAccepted(inviteId, userId) {
  return TroupeInvite.update({
      _id: inviteId,
      state: { $ne: 'ACCEPTED' }
    }, {
      $set: {
        state: 'ACCEPTED',
        userId: userId
      }
    })
    .exec();
}

function markInviteRejected(inviteId, userId) {
  return TroupeInvite.update({
      _id: inviteId,
      state: { $ne: 'REJECTED' }
    }, {
      $set: {
        state: 'REJECTED',
        userId: userId
      }
    })
    .exec();
}

module.exports = {
  createInvite: Promise.method(createInvite),
  accept: Promise.method(accept),
  markInviteAccepted: Promise.method(markInviteAccepted),
  markInviteRejected: Promise.method(markInviteRejected)
}
