'use strict';

const assert = require('assert');
const debug = require('debug')('gitter:app:permissions:gl-group-policy-delegate');
const { GitLabGroupService } = require('gitter-web-gitlab');
const PolicyDelegateTransportError = require('./policy-delegate-transport-error');
const identityService = require('gitter-web-identity');

class GlGroupPolicyDelegate {
  constructor(userId, userLoader, securityDescriptor) {
    assert(userLoader, 'userLoader required');
    assert(securityDescriptor, 'securityDescriptor required');

    this._userId = userId;
    this._userLoader = userLoader;
    this._securityDescriptor = securityDescriptor;
  }

  async hasPolicy(policyName) {
    if (!this._isValidUser()) {
      return false;
    }

    if (this._cachedMembership === undefined) {
      this._cachedMembership = await this._checkMembership();
    }

    switch (policyName) {
      case 'GL_GROUP_MEMBER':
        return !!(this._cachedMembership && this._cachedMembership.isMember);

      case 'GL_GROUP_MAINTAINER':
        return !!(this._cachedMembership && this._cachedMembership.isMaintainer);

      default:
        debug(`Unknown permission ${policyName}, denying access`);
        return false;
    }
  }

  getAccessDetails() {
    if (!this._isValidUser()) return;

    const sd = this._securityDescriptor;
    return {
      type: 'GL_GROUP',
      linkPath: sd.linkPath,
      externalId: sd.externalId
    };
  }

  getPolicyRateLimitKey(policyName) {
    if (!this._isValidUser()) return;
    const uri = this._securityDescriptor.linkPath;

    return 'GL_GROUP:' + this._userId + ':' + uri + ':' + policyName;
  }

  _isValidUser() {
    return !!this._userId;
  }

  async _checkMembership() {
    const uri = this._securityDescriptor.linkPath;

    const user = await this._userLoader();
    const gitLabIdentity = await identityService.getIdentityForUser(user, 'gitlab');

    if (!gitLabIdentity) {
      return null;
    }

    try {
      const glGroupService = new GitLabGroupService(user);
      return await glGroupService.getMembership(uri, gitLabIdentity.providerKey);
    } catch (err) {
      throw new PolicyDelegateTransportError(err.message);
    }
  }
}

module.exports = GlGroupPolicyDelegate;