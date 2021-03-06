'use strict';

const assert = require('assert');
const _ = require('lodash');
const {
  validateVirtualUserType,
  validateVirtualUserExternalId
} = require('gitter-web-users/lib/virtual-user-service');

function bansIncludesVirtualUser(bans, virtualUser) {
  return _.some(bans, function(ban) {
    return (
      ban.virtualUser.type === virtualUser.type &&
      ban.virtualUser.externalId === virtualUser.externalId
    );
  });
}

function VirtualUserPolicyEvaluator(virtualUser, securityDescriptor) {
  assert(virtualUser);
  validateVirtualUserType(virtualUser.type);
  validateVirtualUserExternalId(virtualUser.externalId);
  assert(securityDescriptor);

  this._virtualUser = virtualUser;
  this._securityDescriptor = securityDescriptor;
}

VirtualUserPolicyEvaluator.prototype = {
  canRead: async function() {
    // virtualUsers can only chat in public rooms
    if (this._securityDescriptor.public) {
      return true;
    }

    return false;
  },

  canWrite: async function() {
    // Check if the user has been banned
    if (bansIncludesVirtualUser(this._securityDescriptor.bans, this._virtualUser)) {
      return false;
    }

    // virtualUsers can only chat in public rooms
    if (this._securityDescriptor.public) {
      return true;
    }

    return false;
  },

  canJoin: async function() {
    return this.canWrite();
  },

  canAdmin: async function() {
    return false;
  },

  canAddUser: async function() {
    return this.canWrite();
  }
};

module.exports = VirtualUserPolicyEvaluator;
