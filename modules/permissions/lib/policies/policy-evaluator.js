'use strict';

var env = require('gitter-web-env');
var logger = env.logger.get('permissions');
var Promise = require('bluebird');
var _ = require('lodash');
var mongoUtils = require('gitter-web-persistence-utils/lib/mongo-utils');
var policyCheckRateLimiter = require('./policy-check-rate-limiter');
var PolicyDelegateTransportError = require('./policy-delegate-transport-error');
var debug = require('debug')('gitter:app:permissions:policy-evaluator');
var assert = require('assert');
var knownAccessRecorder = require('../known-external-access/recorder');

var SUCCESS_RESULT_CACHE_TIME = 5 * 60; // 5 minutes in seconds

function PolicyEvaluator(userId, securityDescriptor, policyDelegate, contextDelegate) {
  if (userId) {
    assert(mongoUtils.isLikeObjectId(userId), 'userId must be an ObjectID');
  }

  this._userId = userId;
  this._securityDescriptor = securityDescriptor;
  this._policyDelegate = policyDelegate;
  this._contextDelegate = contextDelegate;
}

PolicyEvaluator.prototype = {
  canRead: Promise.method(function() {
    debug('canRead');
    return this._checkAccess(true) // With Good Faith
      .bind(this)
      .tap(function(access) {
        // If access is denied to the room, let the contextDelegate know
        // so that it can appropriate action
        if (!access && this._contextDelegate) {
          return this._contextDelegate.handleReadAccessFailure();
        }

        return null;
      })
  }),

  canWrite: Promise.method(function() {
    // Anonymous users can never write to a room
    if (!this._userId) return false;

    return this._checkAccess(true); // With Good Faith
  }),

  /**
   * Similar to canRead, but with a full access check
   */
  canJoin: Promise.method(function() {
    // Anonymous users can never join
    if (!this._userId) return false;

    return this._checkAccess(false); // Without Good Faith
  }),

  canAdmin: Promise.method(function() {
    debug('canAdmin');

    var userId = this._userId;

    // Anonymous users are never admins
    if (!userId) {
      debug('canAdmin: deny access for anonymous');
      return false;
    }

    var adminPolicy = this._securityDescriptor.admins;

    if (this._isExtraAdmin()) {
      // The user is in extraAdmins...
      debug('canAdmin: allow access for extraAdmin');
      return true;
    }

    if (adminPolicy === 'MANUAL') {
      // If they're not in extraAdmins they're not an admin
      debug('canAdmin: deny access for no extraAdmin');
      return false;
    }

    var membersPolicy = this._securityDescriptor.members;
    var contextDelegate = this._contextDelegate;
    var policyDelegate = this._policyDelegate;

    if (!policyDelegate) {
      debug('canAdmin: deny access no policy delegate');

      /* No further policy delegate, so no */
      return false;
    }

    // In invite room, in addition to being an admin you also need to
    // be in the room in order to be an admin

    if (membersPolicy === 'INVITE') {
      if (userId && contextDelegate) {
        return this._checkMembershipInContextForInviteRooms()
          .bind(this)
          .then(function(isMember) {
            if (!isMember) {
              // Not a member? Then user is not an admin,
              // unless they are in extraAdmins, which will
              // already have successfully returned above
              return false;
            }
            return this._checkAuthedAdminWithGoodFaith();
          });
      } else {
        return false;
      }
    }

    debug('canAdmin: checking policy delegate with policy %s', adminPolicy);
    return this._checkAuthedAdminWithGoodFaith();
  }),

  canAddUser: function() {
    // Anonymous users can never write to a room
    if (!this._userId) return false;

    return this._checkAccess(true); // With Good Faith
  },

  _checkAccess: Promise.method(function(useGoodFailChecks) {
    // TODO: ADD BANS
    var userId = this._userId;
    var membersPolicy = this._securityDescriptor.members;
    var policyDelegate = this._policyDelegate;

    // Check if the user has been banned
    if (userId && bansIncludesUserId(this._securityDescriptor.bans, userId)) {
      return false;
    }

    if (membersPolicy === 'PUBLIC') {
      debug('canRead: allowing access to PUBLIC');
      // Shortcut for PUBLIC rooms - always allow everyone to read them
      return true;
    }

    if (userId && userIdIsIn(userId, this._securityDescriptor.extraMembers)) {
      // If the user is in extraMembers, always allow them
      // in...
      debug('canRead: allowing access to extraMember');
      return true;
    }

    if (membersPolicy === 'INVITE' || membersPolicy === 'INVITE_OR_ADMIN') {
      return this._checkAccessForInviteMembersPolicy();
    }

    if (!policyDelegate) {
      return false;
    }

    if (userId) {
      // Logged-in user
      if (useGoodFailChecks) {
        return this._checkAuthedMembershipWithGoodFaith();
      } else {
        return this._checkAuthedMembershipWithFullCheck();

      }
    } else {
      // Anonymous case
      return this._checkAnonymousAccessWithGoodFaith();
    }

  }),

  _checkAccessForInviteMembersPolicy: function() {
    var userId = this._userId;
    var membersPolicy = this._securityDescriptor.members;
    var contextDelegate = this._contextDelegate;

    assert(membersPolicy === 'INVITE' ||
      membersPolicy === 'INVITE_OR_ADMIN');

    if (userId && contextDelegate) {
      return this._checkMembershipInContextForInviteRooms()
        .bind(this)
        .then(function(result) {
          if (result) {
            return true;
          } else {
            // Not a member, but explicitly allowed via extraAdmins?
            // Note: we do not do a full admin check as this would allow anyone
            // from the owning room to be allowed into the PRIVATE room.
            // See https://github.com/troupe/gitter-webapp/issues/1742
            // return this._isExtraAdmin();
            return this.canAdmin();
          }
        })
    } else {
      return false;
    }
  },

  /**
   * Returns true iff the user is in extraAdmins
   */
  _isExtraAdmin: function() {
    var userId = this._userId;

    return userIdIsIn(userId, this._securityDescriptor.extraAdmins);
  },

  /**
   * User is in the room or has admin access
   */
  _checkMembershipInContextForInviteRooms: function() {
    var contextDelegate = this._contextDelegate;
    return contextDelegate.isMember();
  },

  /**
   * Anonymous user can access the room, checks cache first
   */
  _checkAnonymousAccessWithGoodFaith: function() {
    var policyDelegate = this._policyDelegate;
    var membersPolicy = this._securityDescriptor.members;

    var rateLimitKey = policyDelegate.getPolicyRateLimitKey(membersPolicy);
    return policyCheckRateLimiter.checkForRecentSuccess(rateLimitKey)
      .bind(this)
      .then(function(recentCheck) {
        if (recentCheck) return true;

        return this._checkAnonymousAccessWithFullCheck();
      });
  },

  /**
   * Anonymous user can access the room, goes to backend
   */
  _checkAnonymousAccessWithFullCheck: function() {
    var securityDescriptor = this._securityDescriptor;
    var policyDelegate = this._policyDelegate;
    var membersPolicy = this._securityDescriptor.members;

    return policyDelegate.hasPolicy(membersPolicy)
      .bind(this)
      .tap(function(access) {
        if (access) {
          var rateLimitKey = policyDelegate.getPolicyRateLimitKey(membersPolicy);
          return policyCheckRateLimiter.recordSuccessfulCheck(rateLimitKey, SUCCESS_RESULT_CACHE_TIME);
        }
      })
      .catch(PolicyDelegateTransportError, function(err) {
        logger.error('Error communicating with policy delegate backend' + err, { exception: err });

        // Anonymous access, public room, allow the user through
        return securityDescriptor.public;
      })
  },

  /**
   * Authenticated user can access the room, with caching
   */
  _checkAuthedMembershipWithGoodFaith: function() {
    var policyDelegate = this._policyDelegate;
    var membersPolicy = this._securityDescriptor.members;

    var rateLimitKey = policyDelegate.getPolicyRateLimitKey(membersPolicy);
    return policyCheckRateLimiter.checkForRecentSuccess(rateLimitKey)
      .bind(this)
      .then(function(recentSuccess) {

        // Whether or not you're a member, you still get access
        if (recentSuccess) {
          return true;
        } else {
          return this._checkAuthedMembershipWithFullCheck()
            .bind(this)
            .then(function(fullCheckResult) {
              // if (!fullCheckResult && isMember) {
              //   // contextDelegate.reportFailure();
              // }

              if (fullCheckResult) return true;
              return this.canAdmin();
            });
        }
      });
  },

  /**
   * Authenticated user can access the room, with full check
   */
  _checkAuthedMembershipWithFullCheck: function() {
    var securityDescriptor = this._securityDescriptor;
    var contextDelegate = this._contextDelegate;
    var membersPolicy = this._securityDescriptor.members;

    return this._checkPolicyCacheResult(membersPolicy)
      .catch(PolicyDelegateTransportError, function(err) {
        logger.error('Error communicating with policy delegate backend' + err, { exception: err });

        if (securityDescriptor.public) return true;

        if (!contextDelegate) {
          return false;
        }

        return contextDelegate.isMember()
          .then(function(isMember) {
            if (isMember) {
              logger.error('Backend down but allowing user to access room on account of already being a member');
              return true;
            }

            return false;
          });
      });
  },

  _checkAuthedAdminWithGoodFaith: function() {
    var policyDelegate = this._policyDelegate;
    var adminPolicy = this._securityDescriptor.admins;

    var rateLimitKey = policyDelegate.getPolicyRateLimitKey(adminPolicy);
    return policyCheckRateLimiter.checkForRecentSuccess(rateLimitKey)
      .bind(this)
      .then(function(recentSuccess) {

        // Whether or not you're a member, you still get access
        if (recentSuccess) {
          return true;
        } else {
          return this._checkAuthedAdminWithFullCheck()
        }
      });
  },

  _checkAuthedAdminWithFullCheck: function() {
    var adminPolicy = this._securityDescriptor.admins;

    return this._checkPolicyCacheResult(adminPolicy)
      .catch(PolicyDelegateTransportError, function(err) {
        logger.error('Error communicating with policy delegate backend' + err, { exception: err });

        return false;
      });
  },

  _checkPolicyCacheResult: function(policyName) {
    var policyDelegate = this._policyDelegate;

    return policyDelegate.hasPolicy(policyName)
      .bind(this)
      .tap(function(access) {
        var userId = this._userId;

        if (userId) {
          // Cache the access for admin user lookups
          var accessDetails = policyDelegate.getAccessDetails(policyName);
          if (accessDetails) {
            // This is not chained to the promise
            knownAccessRecorder(userId, accessDetails.type, policyName, accessDetails.linkPath, accessDetails.externalId, access);
          }
        }

        if (access) {
          // If successful, cache the result for a short period
          var rateLimitKey = policyDelegate.getPolicyRateLimitKey(policyName);

          if (rateLimitKey) {
            return policyCheckRateLimiter.recordSuccessfulCheck(rateLimitKey, SUCCESS_RESULT_CACHE_TIME);
          }
        }
      })
  }
};

function bansIncludesUserId(bans, userId) {
  if (!bans || !bans.length) return false;

  if (bans.length === 1) {
    return mongoUtils.objectIDsEqual(userId, bans[0].userId);
  }

  return _.some(bans, function(ban) {
    return mongoUtils.objectIDsEqual(userId, ban.userId);
  });
}


function userIdIsIn(userId, collection) {
  if (!collection || !collection.length) return false;

  if (collection.length === 1) {
    return mongoUtils.objectIDsEqual(userId, collection[0]);
  }

  return _.some(collection, function(item) {
    return mongoUtils.objectIDsEqual(userId, item);
  });
}

module.exports = PolicyEvaluator;
