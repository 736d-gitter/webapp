/*jshint globalstrict:true, trailing:false, unused:true, node:true */
/*global require: true, module: true */
"use strict";

var persistence = require("./persistence-service");
var userService = require("./user-service");
var appEvents = require("../app-events");
var assert = require("assert");
var emailNotificationService = require("./email-notification-service");
var presenceService = require("./presence-service");
var uuid = require('node-uuid');
var winston = require("winston");
var collections = require("../utils/collections");
var mongoUtils = require("../utils/mongo-utils");
var Q = require("q");
var ObjectID = require('mongodb').ObjectID;
var _ = require('underscore');
var assert = require('assert');
var statsService = require("../services/stats-service");

function ensureExists(value) {
  if(!value) throw 404;
  return value;
}

function findByUri(uri, callback) {
  return persistence.Troupe.findOneQ({uri: uri})
    .nodeify(callback);
}

function findByIds(ids, callback) {
  return persistence.Troupe
    .where('_id')['in'](collections.idsIn(ids))
    .execQ()
    .nodeify(callback);
}

function findById(id, callback) {
  return persistence.Troupe.findByIdQ(id)
    .nodeify(callback);
}

function findByIdRequired(id) {
  return persistence.Troupe.findByIdQ(id)
    .then(ensureExists);
}

/**
 * Like model.createQ, but invokes mongoose middleware
 */
function createQ(ModelType, options) {
  var m = new ModelType(options);
  return m.saveQ()
    .then(function() {
      return m;
    });
}

/**
 * Use this instead of createQ as it invokes Mongoose Middleware
 */
function createTroupeQ(options) {
  return createQ(persistence.Troupe, options);
}

function createInviteQ(options) {
  return createQ(persistence.Invite, options);
}

function createInviteUnconfirmedQ(options) {
  return createQ(persistence.InviteUnconfirmed, options);
}

function createRequestQ(options) {
  return createQ(persistence.Request, options);
}

function createRequestUnconfirmedQ(options) {
  return createQ(persistence.RequestUnconfirmed, options);
}


function findMemberEmails(id, callback) {
  findById(id, function(err,troupe) {
    if(err) callback(err);
    if(!troupe) callback("No troupe returned");

    var userIds = troupe.getUserIds();

    userService.findByIds(userIds, function(err, users) {
      if(err) callback(err);
      if(!users) callback("No users returned");

      var emailAddresses = users.map(function(item) { return item.email; } );

      callback(null, emailAddresses);
    });

  });
}

function findAllTroupesForUser(userId, callback) {
  return persistence.Troupe
    .where('users.userId', userId)
    .sort({ name: 'asc' })
    .execQ()
    .nodeify(callback);
}

function findAllTroupesIdsForUser(userId, callback) {
  return persistence.Troupe
    .where('users.userId', userId)
    .select('id')
    .execQ()
    .then(function(result) {
      var troupeIds = result.map(function(troupe) { return troupe.id; } );
      return troupeIds;
    })
    .nodeify(callback);
}

function userHasAccessToTroupe(user, troupe) {
  return troupe.containsUserId(user.id);
}

function userIdHasAccessToTroupe(userId, troupe) {
  return troupe.containsUserId(userId);
}

function validateTroupeEmail(options, callback) {
  var from = options.from;
  var to = options.to;

  /* TODO: Make this email parsing better! */
  var uri = to.split('@')[0];

  userService.findByEmail(from, function(err, fromUser) {
    if(err) return callback(err);
    if(!fromUser) return callback("Access denied");

    findByUri(uri, function(err, troupe) {
      if(err) return callback(err);
      if(!troupe) return callback("Troupe not found for uri " + uri);

      if(!userHasAccessToTroupe(fromUser, troupe)) {
        return callback("Access denied");
      }

      return callback(null,troupe, fromUser);

    });
  });
}

function validateTroupeEmailAndReturnDistributionList(options, callback) {
  var from = options.from;
  var to = options.to;

  /* TODO: Make this email parsing better! */
  var uri = to.split('@')[0];

  userService.findByEmail(from, function(err, fromUser) {
    if(err) return callback(err);
    if(!fromUser) return callback("Access denied");

    findByUri(uri, function(err, troupe) {
      if(err) return callback(err);
      if(!troupe) return callback("Troupe not found for uri " + uri);
      if(!userHasAccessToTroupe(fromUser, troupe)) {
        return callback("Access denied");
      }

      userService.findByIds(troupe.getUserIds(), function(err, users) {
        if(err) return callback(err);

        var emailAddresses = users.map(function(user) {
          return user.email;
        });

        return callback(null, troupe, fromUser, emailAddresses);
      });
    });
  });
}

/*
 * This function takes in a userId and a list of troupes
 * It returns a hash that tells whether the user has access to each troupe,
 * or null if the troupe represented by the uri does not exist.
 * For example:
 * For the input validateTroupeUrisForUser('1', ['a','b','c'],...)
 * The callback could return:
 * {
 *   'a': true,
 *   'b': false,
 *   'c': null
 * }
 * Mean: User '1' has access to 'a', no access to 'b' and no troupe 'c' exists
 */
function validateTroupeUrisForUser(userId, uris, callback) {
  persistence.Troupe
    .where('uri')['in'](uris)
    .where('status', 'ACTIVE')
    .exec(function(err, troupes) {
      if(err) return callback(err);

      var troupesByUris = collections.indexByProperty(troupes, "uri");

      var result = {};
      uris.forEach(function(uri) {
        var troupe = troupesByUris[uri];
        if(troupe) {
          result[uri] = troupe.containsUserId(userId);
        } else {
          result[uri] = null;
        }
      });

      callback(null, result);
    });
}

/**
 * Add the specified user to the troupe,
 * @param {[type]} userId
 * @param {[type]} troupeId
 * returns a promise with the troupe
 */
function addUserIdToTroupe(userId, troupeId) {
  return findByIdRequired(troupeId)
      .then(function(troupe) {
        if(troupe.status != 'ACTIVE') throw { troupeNoLongerActive: true };

        if(troupe.containsUserId(userId)) {
          return troupe;
        }

        appEvents.richMessage({eventName: 'userJoined', troupe: troupe, userId: userId});

        troupe.addUserById(userId);
        return troupe.saveQ()
            .then(function() { return troupe; });
      });
}

/**
 * Returns the URL a particular user would see if they wish to view a URL.
 * NB: this call has to query the db to get a user's username. Don't call it
 * inside a loop!
 *
 * @return promise of a URL string
 */
function getUrlForTroupeForUserId(troupe, userId) {
  if(!troupe.oneToOne) {
    return Q.resolve("/" + troupe.uri);
  }

  var otherTroupeUser = troupe.users.filter(function(troupeUser) {
    return troupeUser.userId != userId;
  })[0];

  if(!otherTroupeUser) throw "Unable to determine other user for troupe#" + troupe.id;

  return userService.findUsernameForUserId(otherTroupeUser.userId)
    .then(function(username) {
      return username ? "/" + username
                      : "/one-one/" + otherTroupeUser.userId;
    });

}
/**
 * Notify existing users of invites. This method does not handle email-only invites for non-registered email addresses
 * @param  {[type]} invites
 * @return promise of undefined
 */
function notifyRecipientsOfInvites(invites) {
  var userIds = collections.idsIn(
                  invites.map(function(i) { return i.userId; })
                    .concat(invites.map(function(i) { return i.fromUserId; })));

  var troupeIds = collections.idsIn(invites.map(function(i) { return i.troupeId; }));

  // Check if the user is online
  var d = Q.defer();
  presenceService.categorizeUsersByOnlineStatus(userIds, d.makeNodeResolver());

  return Q.all([
    userService.findByIds(userIds),
    findByIds(troupeIds),
    d.promise
    ]).spread(function(users, troupes, onlineUsers) {
      troupes = collections.indexById(troupes);
      users = collections.indexById(users);

      var promises = invites.map(function(invite) {
        var toUserId = invite.userId;
        var userIsOnline = onlineUsers[toUserId];

        var troupe = troupes[invite.troupeId];
        var toUser = users[toUserId];
        var fromUser = users[invite.fromUserId];

        assert(fromUser, 'Could not find fromUser: ' + invite.fromUserId);
        assert(toUser, 'Could not find toUser. notifyRecipientsOfInvites only deals with existing user recipients, not email recipients');

        if(userIsOnline) {
          var text, uri;
          if(invite.troupeId && troupe) {
            text = "You've been invited to join the Troupe: " + troupe.name;
            uri = troupe.uri;
          } else if(!invite.troupeId && fromUser) {
            text = fromUser.displayName + " has invited you to connect";
            uri = fromUser.getHomeUri();
          }

          appEvents.userNotification({
            userId: toUserId,
            troupeId: troupe ? troupe.id : undefined,
            // TODO: add onetoone bits in to this invite
            title: "New Invitation",
            text: text,
            link: '/' + uri,
            sound: "invitation"
          });

          return;
        } else {
          invite.emailSentAt = Date.now();
          return invite.saveQ()
            .then(function() {
              // The user is not online, send them an email
              if(troupe) {
                emailNotificationService.sendInvite(troupe, toUser.displayName, toUser.email, invite.code, fromUser.displayName);
              } else if(!invite.troupeId) {
                // One to one
                emailNotificationService.sendConnectInvite(fromUser.getHomeUrl(), toUser.displayName, toUser.email, invite.code, fromUser.displayName);
              }

            });


        }

      });

      return Q.all(promises);
  });
}

/**
 * Invite an existing user to join a troupe or connect with another user
 * @param  {[ObjectId]} troupe optional
 * @param  {[ObjectId]} fromUserId the user initiating the connection
 * @param  {[ObjectId]} toUserId the recipient
 * @return {[type]} promise with invite
 */
function inviteUserByUserId(troupe, fromUser, toUserId) {
  assert(fromUser, "fromUser expected");
  assert(toUserId, "toUserId expected");

  // Find the user
  return userService.findById(toUserId)
    .then(function(toUser) {
      assert(toUser, "toUserId " + toUser + " not found");

      var fromUserId = fromUser.id;
      assert(fromUserId, 'fromUser.id is missing');

      var chain = null;

      if(troupe) {
        // Never any chance of an implicit connection for troupe invites, just return false
        chain = Q.resolve(false);
      } else {
        // If this invite is for a onetoone and the users have an implicit connection
        // then simply connect them up and be done with it

        chain = findImplicitConnectionBetweenUsers(fromUserId, toUserId)
          .then(function(hasImplicitConnection) {
            if(hasImplicitConnection) {
              return findOrCreateOneToOneTroupe(fromUserId, toUserId)
                .then(function() {
                  // Can't really think we should return here, this will have to do
                  return true;
                });
            }

            return false;
          });
      }

      return chain.then(function(hasImplicitConnection) {
        if(hasImplicitConnection) return null; // No invite needed

        var collection = fromUser.isConfirmed() ? persistence.Invite : persistence.InviteUnconfirmed;

        // Look for an existing invite
        var query = { status: 'UNUSED', userId: toUserId };
        if(!troupe) {
          query.fromUserId = fromUserId;
          query.troupeId = null;
        } else {
          query.troupeId = troupe.id;
        }

        return collection.findOneQ(query)
          .then(function(existingInvite) {

            // Existing invite? Use it
            if (existingInvite) {
              return existingInvite;
            }

            var inviteData = {
                troupeId: troupe ? troupe.id : null,
                fromUserId: fromUserId,
                userId: toUserId,
                displayName: null, // Don't set this if we're using a userId
                email: null,       // Don't set this if we're using a userId
                code: toUser.isConfirmed() ? null : uuid.v4(),
                status: 'UNUSED'
              };

            return  fromUser.isConfirmed() ? createInviteQ(inviteData) : createInviteUnconfirmedQ(inviteData);

          }).then(function(invite) {
            // Notify the recipient, if the user is confirmed
            if(!fromUser.isConfirmed()) return invite;

            return notifyRecipientsOfInvites([invite])
                    .then(function() {
                      return invite;
                    });
          });
      });




  });
}

/**
 * Invite by email
 * @param  {[type]} troupe optional - not supplied for one to one invitations
 * @param  {[type]} fromUserId the user making the request
 * @param  {[type]} displayName (optional) the name of the recipient
 * @param  {[type]} email the email address of the recipient
 * @return {[type]} promise with invite
 */
function inviteUserByEmail(troupe, fromUser, displayName, email) {
  assert(fromUser && fromUser.id, "fromUser expected");
  assert(email, "email expected");
  assert(!troupe || troupe.id, "troupe must have an id");

  // Only non-registered users should go through this flow.
  // Check if the email is registered to a user.
  return userService.findByEmail(email)
    .then(function(user) {

      if(user) {
        return inviteUserByUserId(troupe, fromUser, user.id);
      }

      var fromUserId = fromUser.id;

      var query = troupe ? { status: "UNUSED", troupeId: troupe.id, email: email }
                         : { status: "UNUSED", fromUserId: fromUser.id, email: email };

      return persistence.Invite.findOneQ(query)
          .then(function(existingInvite) {
            // Found an existing invite? Don't create a new one then
            if(existingInvite) return existingInvite;

            statsService.event('new_user_invite', { userId: fromUserId, invitedEmail: email, email: fromUser.email });

            // create the invite and send mail immediately

            return createInviteQ({
              troupeId: troupe && troupe.id,
              fromUserId: fromUserId,
              displayName: displayName,
              email: email,
              emailSentAt: Date.now(),
              code: uuid.v4()
            });

          }).then(function(invite) {
            if(troupe) {
              // For new or existing invites, send the user an email
              emailNotificationService.sendInvite(troupe, displayName, email, invite.code, fromUser.displayName);
            } else {
              // For new or existing invites, send the user an email
              emailNotificationService.sendConnectInvite(fromUser.getHomeUrl(), displayName, email, invite.code, fromUser.displayName);
            }

            return invite;
          });

    });
}

/**
 * Invite a user to either join a troupe or connect for one-to-one chats
 * @param  {[type]}   troupe (optional)
 * @param  {[type]}   invite ({ fromUser / userId / displayName / email  })
 * @return {[type]}   promise of an invite
 */
function createInvite(troupe, options, callback) {

  return Q.resolve(null)
    .then(function() {

      assert(options.fromUser, 'fromUser required');
      assert(options.fromUser.id, 'fromUser.id required');

      if(options.userId) {
        return inviteUserByUserId(troupe, options.fromUser, options.userId);
      }

      if(options.email) {
        return inviteUserByEmail(troupe, options.fromUser, options.displayName, options.email);
      }

      throw "Invite needs an email or userId";
    }).nodeify(callback);
}

function findInviteById(id, callback) {
  return persistence.Invite.findByIdQ(id)
    .nodeify(callback);
}

function findInviteByConfirmationCode(confirmationCode) {
  return persistence.Invite.findOneQ({ code: confirmationCode });
}


function findAllUnusedInvitesForTroupe(troupeId, callback) {
   return persistence.Invite.where('troupeId').equals(troupeId)
      .where('status').equals('UNUSED')
      .sort({ displayName: 'asc', email: 'asc' } )
      .execQ()
      .nodeify(callback);
}

function findUnusedInviteToTroupeForUserId(userId, troupeId, callback) {
  return persistence.Invite.findOneQ({ troupeId: troupeId, userId: userId, status: 'UNUSED' }).nodeify(callback);
}

/**
 * Find an unused invite from fromUserId to toUserId for toUserId to connect with fromUserId
 * @param  {[type]} fromUserId
 * @param  {[type]} toUserId
 * @return {[type]} promise with invite
 */
function findUnusedOneToOneInviteFromUserIdToUserId(fromUserId, toUserId) {
  return persistence.Invite.findOneQ({
      troupeId: null, // This indicates that it's a one-to-one invite
      fromUserId: fromUserId,
      userId: toUserId,
      status: 'UNUSED'
    });
}

/**
 * Finds all unconfirmed invites for a recently confirmed user,
 * notifies recipients
 * @return {promise} no value
 */
function updateUnconfirmedInvitesForUserId(userId) {
  return persistence.InviteUnconfirmed.findQ({ fromUserId: userId })
      .then(function(invites) {
        winston.info('Creating ' + invites.length + ' invites for recently confirmed user ' + userId);
        var promises = invites.map(function(invite) {
          return createInviteQ(invite)
            .then(function(newInvite) {
              return invite.removeQ()
                .then(function() {
                  return newInvite;
                });
              });
        });

        return Q.all(promises)
          .then(function(invites) {
            return notifyRecipientsOfInvites(invites);
          });
      });
}

/**
 * Finds all unconfirmed requests for a recently confirmed user,
 * notifies recipients
 * @return {promise} no value
 */
function updateUnconfirmedRequestsForUserId(userId) {
  return persistence.RequestUnconfirmed.findQ({ userId: userId })
      .then(function(requests) {
        winston.info('Creating ' + requests.length + ' requests for recently confirmed user ' + userId);

        var promises = requests.map(function(request) {
          return createRequestQ(request)
            .then(function() {
              return request.removeQ();
            });
        });

        return Q.all(promises);
      });
}

function updateInvitesForEmailToUserId(email, userId, callback) {
  return persistence.Invite.updateQ(
    { email: email },
    {
      userId: userId,
      email: null,
      displayName: null
    },
    { multi: true })
    .then(function() {
      return true;
    })
    .nodeify(callback);
}

function findAllUnusedInvitesForUserId(userId, callback) {
  return persistence.Invite.where('userId').equals(userId)
    .where('status').equals('UNUSED')
    .sort({ createdAt: 'asc' } )
    .execQ()
    .nodeify(callback);
}

function findAllUnusedConnectionInvitesFromUserId(userId, callback) {
  return persistence.Invite.where('fromUserId').equals(userId)
    .where('troupeId').equals(null)
    .where('status').equals('UNUSED')
    .sort({ createdAt: 'asc' } )
    .execQ()
    .nodeify(callback);
}

function findAllUnusedInvitesForEmail(email, callback) {
  return persistence.Invite.where('email').equals(email)
    .where('status').equals('UNUSED')
    .sort({ displayName: 'asc', email: 'asc' } )
    .execQ()
    .nodeify(callback);
}

function removeUserFromTroupe(troupeId, userId, callback) {
  findById(troupeId, function(err, troupe) {
    if(err) return callback(err);
    if(!troupe) return callback('Troupe ' + troupeId + ' does not exist.');

    // TODO: Add the user to a removeUsers collection
    var deleteRecord = new persistence.TroupeRemovedUser({
      userId: userId,
      troupeId: troupeId
    });

    deleteRecord.save(function(err) {
      if(err) return callback(err);

      // TODO: Let the user know that they've been removed from the troupe (via email or something)
      troupe.removeUserById(userId);
      if(troupe.users.length === 0) {
        return callback("Cannot remove the last user from a troupe");
      }
      troupe.save(callback);
    });
  });
}


/**
 * Create a request or simply return an existing one
 * returns a promise of a request
 */
function addRequest(troupe, user) {
  assert(troupe, 'Troupe parameter is required');
  assert(user, 'User parameter is required');

  var userId = user.id;
  assert(user.id, 'User.id parameter is required');

  var collection = user.isConfirmed() ? persistence.Request : persistence.RequestUnconfirmed;

  if(userIdHasAccessToTroupe(userId, troupe)) {
    throw { memberExists: true };
  }

  return collection.findOneQ({
    troupeId: troupe.id,
    userId: userId,
    status: 'PENDING' })
    .then(function(request) {
      // Request already made....
      if(request) return request;

      var requestData = {
        troupeId: troupe.id,
        userId: userId,
        status: 'PENDING'
      };

      return user.isConfirmed() ? createRequestQ(requestData) : createRequestUnconfirmedQ(requestData);
    });
}

/*
 * callback is function(err, requests)
 */
function findAllOutstandingRequestsForTroupe(troupeId, callback) {
  persistence.Request
      .where('troupeId', troupeId)
      .where('status', 'PENDING')
      .exec(callback);
}

function findPendingRequestForTroupe(troupeId, id, callback) {
  persistence.Request.findOne( {
    troupeId: troupeId,
    _id: id,
    status: 'PENDING'
  }, callback);
}


function findRequestsByIds(requestIds, callback) {

  persistence.Request
    .where('_id')['in'](requestIds)
    .exec(callback);

}

/**
 * Accept a request: add the user to the troupe and delete the request
 * @return promise of undefined
 */
function acceptRequest(request, callback) {
  assert(request, 'Request parameter required');

  winston.verbose('Accepting request to join ' + request.troupeId);

  var userId = request.userId;

  return findById(request.troupeId)
    .then(function(troupe) {
      if(!troupe) { winston.error("Unable to find troupe", request.troupeId); throw "Unable to find troupe"; }

      return userService.findById(userId)
        .then(function(user) {
          if(!user) { winston.error("Unable to find user", request.userId); throw "Unable to find user"; }

          emailNotificationService.sendRequestAcceptanceToUser(user, troupe);

          return addUserIdToTroupe(userId, troupe)
              .then(function() {
                return request.removeQ();
              });
        });
    })
    .nodeify(callback);

}


/**
 * Rjected a request: delete the request
 * @return promise of undefined
 */
function rejectRequest(request, callback) {
  winston.verbose('Rejecting request to join ' + request.troupeId);

  return request.removeQ()
    .nodeify(callback);
}

function findUserIdsForTroupe(troupeId, callback) {
  return persistence.Troupe.findByIdQ(troupeId, 'users')
    .then(function(troupe) {
      return troupe.users.map(function(m) { return m.userId; });
    })
    .nodeify(callback);
}

function updateTroupeName(troupeId, troupeName, callback) {
  return findByIdRequired(troupeId)
    .then(function(troupe) {
      troupe.name = troupeName;

      return troupe.saveQ()
        .then(function() {
          return troupe;
        });
    })
    .nodeify(callback);
}

function createOneToOneTroupe(userId1, userId2, callback) {
  winston.verbose('Creating a oneToOne troupe for ', { userId1: userId1, userId2: userId2 });
  return createTroupeQ({
      name: '',
      oneToOne: true,
      status: 'ACTIVE',
      users: [
        { userId: userId1 },
        { userId: userId2 }
      ]
    }).nodeify(callback);
}

// Returns true if the two users share a common troupe
// In future, will also return true if the users share an organisation
function findImplicitConnectionBetweenUsers(userId1, userId2, callback) {
  return persistence.Troupe.findOneQ({
          $and: [
            { 'users.userId': userId1 },
            { 'users.userId': userId2 }
          ]
        }, "_id")
    .then(function(troupe) {
      return !!troupe;
    })
    .nodeify(callback);
}

function findOneToOneTroupe(fromUserId, toUserId) {
  if(fromUserId == toUserId) throw "You cannot be in a troupe with yourself.";
  assert(fromUserId, 'fromUserId parameter required');
  assert(toUserId, 'fromUserId parameter required');

  /* Find the existing one-to-one.... */
  return persistence.Troupe.findOneQ({
        $and: [
          { oneToOne: true },
          { 'users.userId': fromUserId },
          { 'users.userId': toUserId }
        ]
    });

}
/**
 * Find a one-to-one troupe, otherwise create it if possible (if there is an implicit connection),
 * otherwise return the existing invite if possible
 *
 * @return {[ troupe, other-user, invite ]}
 */
function findOrCreateOneToOneTroupe(fromUserId, toUserId) {
  assert(fromUserId, 'fromUserId parameter required');
  assert(toUserId, 'toUserId parameter required');
  assert(fromUserId != toUserId, 'You cannot be in a troupe with yourself.');

  return userService.findById(toUserId)
    .then(function(toUser) {
      if(!toUser) throw "User does not exist";

      /* Find the existing one-to-one.... */
      return [toUser, persistence.Troupe.findOneQ({
        $and: [
          { oneToOne: true },
          { 'users.userId': fromUserId },
          { 'users.userId': toUserId }
        ]
      })];
    })
    .spread(function(toUser, troupe) {

      // Found the troupe? Perfect!
      if(troupe) return [ troupe, toUser, null ];

      return findImplicitConnectionBetweenUsers(fromUserId, toUserId)
          .then(function(implicitConnection) {
            if(implicitConnection) {
              // There is an implicit connection between these two users,
              // automatically create the troupe
              return createOneToOneTroupe(fromUserId, toUserId)
                .then(function(troupe) {
                  return [ troupe, toUser, null ];
                });
            }

            // There is no implicit connection between the users, don't create the troupe
            // However, do tell the caller whether or not this user already has an invite to the
            // other user to connect

            // Otherwise the users cannot onnect the and the user will need to invite the other user
            // to connect explicitly.
            // Check if the user has already invited the other user to connect

            // Look to see if the other user has invited this user to connect....
            // NB from and to users are swapped around here as we are looking for the correlorary (sp)
            return findUnusedOneToOneInviteFromUserIdToUserId(toUserId, fromUserId)
              .then(function(invite) {
                return [ null, toUser, invite ];
              });

          });
    });

}

/**
 * Take a one to one troupe and turn it into a normal troupe with extra invites
 * @return promise with new troupe
 */
function upgradeOneToOneTroupe(options, callback) {
  var name = options.name;
  var fromUser = options.user;
  var invites = options.invites;
  var origTroupe = options.oneToOneTroupe.toObject();

  // create a new, normal troupe, with the current users from the one to one troupe
  return createTroupeQ({
      uri: createUniqueUri(),
      name: name,
      status: 'ACTIVE',
      users: origTroupe.users
    })
    .then(function(troupe) {

      if(!invites || invites.length === 0) return troupe;

      var promises = invites.map(function(invite) {
          return createInvite(troupe, {
            fromUser: fromUser,
            email: invite.email,
            displayName: invite.displayName,
            userId: invite.userId
          });
        });

      // Create invites for all the users
      return Q.all(promises)
        .then(function() {
          return troupe;
        });

    })
    .nodeify(callback);

}

function createUniqueUri() {
  var chars = "0123456789abcdefghiklmnopqrstuvwxyz";

  var uri = "";
  for(var i = 0; i < 6; i++) {
    var rnum = Math.floor(Math.random() * chars.length);
    uri += chars.substring(rnum, rnum + 1);
  }

  return uri;
}

function updateFavourite(userId, troupeId, isFavourite, callback) {
  var setOp = {};
  setOp['favs.' + troupeId] = '1';
  var updateStatement;
  var updateOptions;

  if(isFavourite) {
    updateStatement = { $set: setOp };
    updateOptions = { upsert: true };
  } else {
    updateStatement = { $unset: setOp };
    updateOptions = { };
  }

  return persistence.UserTroupeFavourites.updateQ(
    { userId: userId },
    updateStatement,
    updateOptions)
    .then(function() {
      // Fire a realtime event
      appEvents.dataChange2('/user/' + userId + '/troupes', 'patch', { id: troupeId, favourite: isFavourite });
    })
    .nodeify(callback);
}

function findFavouriteTroupesForUser(userId, callback) {
  return persistence.UserTroupeFavourites.findOneQ({ userId: userId})
    .then(function(userTroupeFavourites) {
      if(!userTroupeFavourites || !userTroupeFavourites.favs) return {};

      return userTroupeFavourites.favs;
    })
    .nodeify(callback);
}

function findAllUserIdsForTroupes(troupeIds, callback) {
  if(!troupeIds.length) return callback(null, []);

  var mappedTroupeIds = troupeIds.map(function(d) {
    if(typeof d === 'string') return new ObjectID('' + d);
    return d;
  });

  return persistence.Troupe.aggregateQ([
    { $match: { _id: { $in: mappedTroupeIds } } },
    { $project: { _id: 0, 'users.userId': 1 } },
    { $unwind: '$users' },
    { $group: { _id: 1, userIds: { $addToSet: '$users.userId' } } }
    ])
    .then(function(results) {
      var result = results[0];
      if(!result || !result.userIds || !result.userIds.length) return [];

      return result.userIds;
    })
    .nodeify(callback);
}

function findAllUserIdsForTroupe(troupeId) {
  return persistence.Troupe.findByIdQ(troupeId, 'users', { lean: true })
    .then(function(troupe) {
      if(!troupe) throw 404;

      return troupe.users.map(function(troupeUser) { return troupeUser.userId; });
    });
}

function findAllUserIdsForUnconnectedImplicitContacts(userId, callback) {
  return Q.all([
      findAllImplicitContactUserIds(userId),
      findAllConnectedUserIdsForUserId(userId)
    ])
    .spread(function(implicitConnectionUserIds, alreadyConnectedUserIds) {
      alreadyConnectedUserIds = alreadyConnectedUserIds.map(function(id) { return "" + id; });

      return _.difference(implicitConnectionUserIds, alreadyConnectedUserIds);
    })
    .nodeify(callback);
}

function findAllConnectedUserIdsForUserId(userId) {
  userId = mongoUtils.asObjectID(userId);

  return persistence.Troupe.aggregateQ([
    { $match: { 'users.userId': userId, oneToOne: true } },
    { $project: { 'users.userId': 1, _id: 0 } },
    { $unwind: "$users" },
    { $group: { _id: '$users.userId', number: { $sum: 1 } } },
    { $project: { _id: 1 } }
  ]).then(function(results) {
    var a = results
            .map(function(item) { return item._id; })
            .filter(function(item) { return "" + item != "" + userId; });
    return a;
  });

}

function findAllImplicitContactUserIds(userId, callback) {
  userId = mongoUtils.asObjectID(userId);

  return persistence.Troupe.aggregateQ([
    { $match: { 'users.userId': userId } },
    { $project: { 'users.userId': 1, _id: 0 } },
    { $unwind: "$users" },
    { $group: { _id: '$users.userId', number: { $sum: 1 } } },
    { $project: { _id: 1 } }
  ]).then(function(results) {
    return results
          .map(function(item) { return "" + item._id; })
          .filter(function(item) { return item != userId; });

  }).nodeify(callback);

}



/**
 * Find the best troupe for a user to access
 * @return promise of a troupe or null
 */
function findBestTroupeForUser(user, callback) {
  //
  // This code is invoked when a user's lastAccessedTroupe is no longer valid (for the user)
  // or the user doesn't have a last accessed troupe. It looks for all the troupes that the user
  // DOES have access to (by querying the troupes.users collection in mongo)
  // If the user has a troupe, it takes them to the last one they accessed. If the user doesn't have
  // any valid troupes, it returns an error.
  //
  var op;
  if (user.lastTroupe) {
     op = findById(user.lastTroupe)
      .then(function(troupe) {

        if(!troupe || troupe.status == 'DELETED' || !userHasAccessToTroupe(user, troupe)) {
          return findLastAccessedTroupeForUser(user);
        }

        return troupe;
      });

  } else {
    op = findLastAccessedTroupeForUser(user);
  }

  return op.nodeify(callback);
}

/**
 * Find the last troupe that a user accessed that the user still has access to
 * that hasn't been deleted
 * @return promise of a troupe (or null)
 */
function findLastAccessedTroupeForUser(user, callback) {
  return persistence.Troupe.findQ({ 'users.userId': user.id, 'status': 'ACTIVE' }).then(function(activeTroupes) {
    if (!activeTroupes || activeTroupes.length === 0) return null;

    return userService.getTroupeLastAccessTimesForUser(user.id).then(function(troupeAccessTimes) {
      activeTroupes.forEach(function(troupe) {
        troupe.lastAccessTime = troupeAccessTimes[troupe._id];
      });

      var troupes = _.sortBy(activeTroupes, function(t) {
        return (t.lastAccessTime) ? t.lastAccessTime : 0;
      }).reverse();

      var troupe = _.find(troupes, function(troupe) {
        return userHasAccessToTroupe(user, troupe);
      });

      return troupe;
    });

  }).nodeify(callback);

}

//
//
//
/**
 * Create a new troupe from a one-to-one troupe and auto-invite users
 * @return promise of a troupe
 */
function createNewTroupeForExistingUser(options, callback) {
  return Q.resolve(null).then(function() {
    var name = options.name;
    var oneToOneTroupeId = options.oneToOneTroupeId;
    var user = options.user;
    var invites = options.invites;

    name = name ? name.trim() : '';

    assert(user, 'user required');
    assert(name, 'Please provide a troupe name');

    if (oneToOneTroupeId) {
      // find this 1-1 troupe and create a new normal troupe with the additional person(s) invited
      return findById(oneToOneTroupeId)
        .then(function(troupe) {
          if(!userHasAccessToTroupe(user, troupe)) {
            throw 403;
          }

          return upgradeOneToOneTroupe({ name: name, oneToOneTroupe: troupe, user: user, invites: invites });
        });
    }

    // create a troupe normally
    var troupe = new persistence.Troupe({
      name: name,
      uri: createUniqueUri()
    });
    troupe.addUserById(user.id);
    return troupe.saveQ()
      .then(function() {

        if(!invites) return troupe;

        var promises = invites.map(function(invite) {
          var displayName = invite.displayName;
          var inviteEmail = invite.email;
          var toUserId = invite.userId;

          if (displayName && inviteEmail || toUserId) {
            return createInvite(troupe, {
                fromUser: user,
                displayName: displayName,
                email: inviteEmail,
                userId: toUserId
              });
          }
        });

        return Q.all(promises).then(function() {
          return troupe;
        });
      });

  }).nodeify(callback);

}

function sendInviteAcceptedNotice(invite, troupe, isNormalTroupe) {
  assert(invite); assert(troupe);

  if (isNormalTroupe)
    return; // we don't send notices for invite acceptances to normal troupes

  var findTroupe = getUrlForTroupeForUserId(troupe, invite.userId);
  var findFromUser = userService.findById(invite.fromUserId);
  var findToUser = userService.findById(invite.userId);

  Q.spread([findFromUser, findToUser, findTroupe], function(fromUser, toUser, troupeUri) {

    if (fromUser && troupeUri) {
      emailNotificationService.sendConnectAcceptanceToUser(fromUser, toUser, troupeUri);
    } else {
      winston.info("Couldn't lookup invite sender to send acceptance notice to");
    }
  });
}

// so that the invite doesn't show up in the receiver's list of pending invitations
// marks the invite as used
function rejectInviteForAuthenticatedUser(user, invite) {
  return Q.resolve(null).then(function() {
    assert(user, 'User parameter required');
    assert(invite, 'invite parameter required');


    if(invite.email !== user.email && invite.userId != user.id) {
      throw 401;
    }

    statsService.event('invite_rejected', { userId: user.id, inviteId: invite.id });
    winston.verbose("Invite rejected", { inviteId: invite.id });

    return markInviteUsedAndDeleteAllSimilarOutstandingInvites(invite);
  });
}

/**
 * Accept an invite to a one to one connection or a troupe
 * @return the promise of a troupe
 */
function acceptInviteForAuthenticatedUser(user, invite) {
  return Q.resolve(null).then(function() {
    assert(user, 'User parameter required');
    assert(invite, 'invite parameter required');

    if(!user.hasEmail(invite.email) && invite.userId != user.id) {
      throw 401;
    }

    // TODO: this will not be used in future once invites are all delete
    if(invite.status !== 'UNUSED') {
      // invite has been used, we can't use it again.
      winston.verbose("Invite has already been used", { inviteId: invite.id });
      statsService.event('invite_reused', { userId: user.id, inviteId: invite.id });

      throw { alreadyUsed: true };
    }

    // use and delete invite
    statsService.event('invite_accepted', { userId: user.id, email: user.email, inviteId: invite.id, new_user: user.status !== 'ACTIVE' });
    winston.verbose("Invite accepted for authd user", { inviteId: invite.id });

    // Either add the user or create a one to one troupe. depending on whether this
    // is a one to one invite or a troupe invite
    var isNormalTroupe = !!invite.troupeId;

    return (isNormalTroupe ? addUserIdToTroupe(user.id, invite.troupeId)
                            : createOneToOneTroupe(invite.fromUserId, invite.userId))
      .then(function(troupe) {

        // once user is added / troupe is created, send email notice
        sendInviteAcceptedNotice(invite, troupe, isNormalTroupe);

        // Regardless of the type, mark things as done
        return markInviteUsedAndDeleteAllSimilarOutstandingInvites(invite)
          .thenResolve(troupe);
      });

  });
}

/**
 * Given a
 * @param  {[type]} invite
 * @return {[type]}
 */
function findRecipientForInvite(invite) {
  if(invite.userId) {
    return userService.findById(invite.userId);
  }

  return userService.findByEmail(invite.email);
}

// Accept an invite, returns callback(err, user, alreadyExists)
// NB NB NB user should only ever be set iff the invite is valid
/**
 * Accepts an invite
 * @param  {String}   confirmationCode
 * @param  {String}   troupeUri
 * @param  {Function} callback
 * @return {promise}  promise with { user: x, alreadyUsed: bool } if the invitation is valid
 */
function acceptInvite(confirmationCode, troupeUri, callback) {
  return persistence.Invite.findOneQ({ code: confirmationCode })
    .then(function(invite) {
      if(!invite || invite.status !== 'UNUSED' /* TODO remove this term later */) {
        return persistence.InviteUsed.findOneQ({ code: confirmationCode })
          .then(function(usedInvite) {
            if(!usedInvite) {
              winston.error("Invite confirmationCode=" + confirmationCode + " not found. ");
              return { user: null };
            }

            return findRecipientForInvite(usedInvite)
              .then(function(user) {
                /* The invite has already been used. We need to fail authentication (if they have completed their profile), but go to the troupe */
                winston.verbose("Invite has already been used", { confirmationCode: confirmationCode, troupeUri: troupeUri });
                statsService.event('invite_reused', { userId: user.id, uri: troupeUri });

                // If the user has clicked on the invite, but hasn't completed their profile (as in does not have a password)
                // then we'll give them a special dispensation and allow them to access the site (otherwise they'll never get in)
                if (user && user.status == 'PROFILE_NOT_COMPLETED') {
                  return { user: user };
                }

                return { user: null, alreadyUsed: true };
              });

          });
      }

      return findRecipientForInvite(invite)
        .then(function(user) {

          // If the user doesn't exist and the invite is not used,
          // create the user
          //
          // TODO: in future, once the USED invites are out of the collection the
          // status term in the if below can be removed
          if(!user) {
            return userService.findOrCreateUserForEmail({
              displayName: invite.displayName || invite.email.replace(/@.*/, ""),
              email: invite.email,
              status: "PROFILE_NOT_COMPLETED"
            }).then(function(user) {
              return updateInvitesForEmailToUserId(invite.email, user.id)
                .then(function() {
                  return user;
                });
            });
          }

          return user;
        })
        .then(function(user) {
          // Invite is good to accept

          statsService.event('invite_accepted', { userId: user.id, email: user.email, uri: troupeUri, new_user: user.status !== 'ACTIVE' });
          winston.verbose("Invite accepted", { confirmationCode: confirmationCode, troupeUri: troupeUri });

          var confirmOperation = null;
          // confirm the user if they are not already.
          if (user.status == 'UNCONFIRMED') {
            user.status = 'PROFILE_NOT_COMPLETED';
            confirmOperation = user.saveQ()
                .then(function() {
                  // Find all the unconfirmed requests and invites for this user and mark them
                  return Q.all([
                      updateUnconfirmedInvitesForUserId(user.id),
                      updateUnconfirmedRequestsForUserId(user.id)
                    ]);

                });
          }

          var isNormalTroupe = !!invite.troupeId;
          return Q.all([
              confirmOperation,
              isNormalTroupe ? addUserIdToTroupe(user.id, invite.troupeId) :
                               createOneToOneTroupe(user.id, invite.fromUserId)
            ])
            .spread(function(userSaveResult, troupe) {
              // once user is added / troupe is created, send email notice
              sendInviteAcceptedNotice(invite, troupe, isNormalTroupe);

              return markInviteUsedAndDeleteAllSimilarOutstandingInvites(invite)
                .then(function() {
                  return getUrlForTroupeForUserId(troupe, user.id).then(function(url) {
                    return { user: user, url: url };
                  });
                });
            });

        });

    })
    .nodeify(callback);
}

function sendPendingInviteMails(delaySeconds, callback) {
  delaySeconds = (delaySeconds === null) ? 10 * 60 : delaySeconds;
  var searchParams = {
    status: "UNUSED",
    createdAt: { $lt: Date.now() - delaySeconds },
    emailSentAt: null
  };

  return persistence.Invite.findQ(searchParams)
    .then(function(invites) {
      winston.info("Found " + invites.length + " pending invites to email");

      var troupeIds   = invites.map(function(i) { return i.troupeId; });
      var fromUserIds = invites.map(function(i) { return i.fromUserId; });
      var toUserIds   = invites.map(function(i) { return i.toUserId; });

      return Q.all([
        findByIds(troupeIds),
        userService.findByIds(fromUserIds.concat(toUserIds))
        ])
        .spread(function(troupes, users) {
          troupes = collections.indexById(troupes);
          users = collections.indexById(users);

          var promises = invites.map(function(invite) {
            var email, displayName;

            // Do the save first so that we dont' retry dodgy invites
            invite.emailSentAt = Date.now();
            return invite.saveQ().then(function() {

              if(invite.userId) {
                var user = users[invite.userId];
                if(!user) {
                  winston.error('Unable to find recipient user ' + invite.userId + '. Will not send out invite');
                  return;
                }
                email = user.email;
                displayName = user.displayName;
              } else {
                email = invite.email;
                displayName = invite.displayName;
              }

              var fromUser = users[invite.fromUserId];
              if(!fromUser) {
                winston.error('Unable to find from user ' + invite.fromUserId + '. Will not send out invite');
                return;
              }

              if(invite.troupeId) {
                var troupe = troupes[invite.troupeId];
                if(!troupe) {
                  winston.error('Unable to find troupe ' + invite.troupeId+ '. Will not send out invite');
                  return;
                }

                emailNotificationService.sendInvite(troupe, displayName, email, invite.confirmationCode, fromUser.displayName);
              } else {
                // One-to-one type invite
                emailNotificationService.sendConnectInvite(fromUser.getHomeUrl(), displayName, email, invite.confirmationCode, fromUser.displayName);
              }

            });

          });

          return Q.all(promises).then(function() {
            return invites.length;
          });
        });

    })
    .nodeify(callback);
}

/**
 * markInviteUsedAndDeleteAllSimilarOutstandingInvites: pretty self explainatory I think
 * @return promise of nothign
 */
function markInviteUsedAndDeleteAllSimilarOutstandingInvites(invite) {
  assert(invite);

  invite.status = 'USED';

  return createQ(persistence.InviteUsed, invite)
    .then(function() {
      return invite.removeQ()
          .then(function() {

            var similarityQuery = { status: 'UNUSED', userId: invite.userId };
            if(invite.troupeId) {
              similarityQuery.troupeId = invite.troupeId;
            } else {
              similarityQuery.fromUserId = invite.fromUserId;
              similarityQuery.troupeId = null; // Important to signify that its a one-to-one invite
            }

            return persistence.Invite.findQ(similarityQuery)
              .then(function(invalidInvites) {
                if(!invalidInvites.length) return;

                // Delete the invalid invites
                var promises = invalidInvites.map(function(invalidInvite) {
                  invalidInvite.status = 'INVALID';

                  return createQ(persistence.InviteUsed, invalidInvite)
                          .then(function() {
                            return invalidInvite.remove();
                          });

                });

                return Q.all(promises);
              });

          });
    });
}

function deleteTroupe(troupe, callback) {
  if(troupe.status != 'ACTIVE') return callback("Troupe is not active");
  if(troupe.users.length !== 1) return callback("Can only delete troupes that have a single user");

  troupe.status = 'DELETED';
  troupe.dateDeleted = new Date();
  troupe.removeUserById(troupe.users[0].userId);
  troupe.save(callback);
}

module.exports = {
  findByUri: findByUri,
  findById: findById,
  findByIds: findByIds,
  findAllTroupesForUser: findAllTroupesForUser,
  findAllTroupesIdsForUser: findAllTroupesIdsForUser,
  validateTroupeEmail: validateTroupeEmail,
  validateTroupeEmailAndReturnDistributionList: validateTroupeEmailAndReturnDistributionList,
  userHasAccessToTroupe: userHasAccessToTroupe,
  userIdHasAccessToTroupe: userIdHasAccessToTroupe,
  createInvite: createInvite,
  findInviteById: findInviteById,
  findInviteByConfirmationCode: findInviteByConfirmationCode,
  findMemberEmails: findMemberEmails,
  findAllUnusedInvitesForTroupe: findAllUnusedInvitesForTroupe,
  findAllUnusedInvitesForEmail: findAllUnusedInvitesForEmail,
  findAllUnusedInvitesForUserId: findAllUnusedInvitesForUserId,
  findAllUnusedConnectionInvitesFromUserId: findAllUnusedConnectionInvitesFromUserId,
  findUnusedInviteToTroupeForUserId: findUnusedInviteToTroupeForUserId,
  findImplicitConnectionBetweenUsers: findImplicitConnectionBetweenUsers,
  findAllUserIdsForUnconnectedImplicitContacts: findAllUserIdsForUnconnectedImplicitContacts,
  findAllImplicitContactUserIds: findAllImplicitContactUserIds,
  findAllConnectedUserIdsForUserId: findAllConnectedUserIdsForUserId,
  updateUnconfirmedInvitesForUserId: updateUnconfirmedInvitesForUserId,
  updateUnconfirmedRequestsForUserId: updateUnconfirmedRequestsForUserId,
  getUrlForTroupeForUserId: getUrlForTroupeForUserId,
  inviteUserByUserId: inviteUserByUserId,

  updateInvitesForEmailToUserId: updateInvitesForEmailToUserId,

  addRequest: addRequest,
  findRequestsByIds: findRequestsByIds,
  findAllOutstandingRequestsForTroupe: findAllOutstandingRequestsForTroupe,
  findPendingRequestForTroupe: findPendingRequestForTroupe,
  acceptRequest: acceptRequest,
  rejectRequest: rejectRequest,
  removeUserFromTroupe: removeUserFromTroupe,

  findAllUserIdsForTroupes: findAllUserIdsForTroupes,
  findAllUserIdsForTroupe: findAllUserIdsForTroupe,
  findUserIdsForTroupe: findUserIdsForTroupe,

  validateTroupeUrisForUser: validateTroupeUrisForUser,
  updateTroupeName: updateTroupeName,
  findOneToOneTroupe: findOneToOneTroupe,
  findOrCreateOneToOneTroupe: findOrCreateOneToOneTroupe,
  createOneToOneTroupe: createOneToOneTroupe,
  createUniqueUri: createUniqueUri,
  deleteTroupe: deleteTroupe,

  updateFavourite: updateFavourite,
  findFavouriteTroupesForUser: findFavouriteTroupesForUser,
  findBestTroupeForUser: findBestTroupeForUser,
  createNewTroupeForExistingUser: createNewTroupeForExistingUser,
  acceptInvite: acceptInvite,
  acceptInviteForAuthenticatedUser: acceptInviteForAuthenticatedUser,
  rejectInviteForAuthenticatedUser: rejectInviteForAuthenticatedUser,
  sendPendingInviteMails: sendPendingInviteMails
};
