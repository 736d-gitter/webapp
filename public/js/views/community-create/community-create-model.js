'use strict';

var Backbone = require('backbone');
var urlJoin = require('url-join');
var stepConstants = require('./step-constants');
var apiClient = require('../../components/api-client');
var Promise = require('bluebird');
var peopleToInviteStatusConstants = require('./people-to-invite-status-constants');

var INVITE_STATUS_PENDING = peopleToInviteStatusConstants.PENDING;
var INVITE_STATUS_READY = peopleToInviteStatusConstants.READY;
var INVITE_STATUS_NEEDS_EMAIL = peopleToInviteStatusConstants.NEEDS_EMAIL;

function inviteNeedsEmailPredicate(invite) {
  return invite.get('inviteStatus') !== INVITE_STATUS_READY;
}

var CommunityCreateModel = Backbone.Model.extend({
  defaults: {
    active: false,
    stepState: stepConstants.MAIN,

    communityName: '',
    communitySlug: '',
    // slugAvailabilityStatusConstants
    communitySlugAvailabilityStatus: null,
    isUsingCustomSlug: false,
    isUsingExplicitGitHubProject: false,
    githubOrgId: null,
    githubRepoId: null,
    allowBadger: true,
    allowTweetBadger: true
  },

  initialize: function(attrs, options) {
    this.orgs = options.orgs;
    this.repos = options.repos;

    this.invites = new Backbone.Collection([]);
  },

  getGithubProjectInfo: function() {
    var githubOrgId = this.get('githubOrgId');

    // Org based?
    if (githubOrgId) {
      var selectedOrg = this.orgs.find(function(org) {
        return org.get('id') === githubOrgId;
      });

      return {
        type: 'GH_ORG',
        linkPath: selectedOrg.get('name'),
        name: selectedOrg.get('name'),
        url: urlJoin('https://github.com', selectedOrg.get('name'))
      };
    }

    // Repo based?
    var githubRepoId = this.get('githubRepoId');
    if (githubRepoId) {
      var selectedRepo = this.repos.find(function(repo) {
        return repo.get('id') === githubRepoId;
      });

      return {
        type: 'GH_REPO',
        linkPath: selectedRepo.get('uri'),
        name: selectedRepo.get('name'),
        url: urlJoin('https://github.com', selectedRepo.get('uri'))
      };
    }

    return {
      type: null
    };
  },

  addInvitation: function(type, externalId, displayName, avatarUrl) {
    var id = type + ':' + externalId;
    if (this.invites.get(id)) {
      // Ignore
      return;
    }

    var inviteStatus = INVITE_STATUS_PENDING;
    var emailAddress = null;

    if (type === 'email') {
      inviteStatus = INVITE_STATUS_READY;
      emailAddress = externalId;
    }

    var invite = this.invites.add({
      id: id,
      type: type,
      externalId: externalId,
      displayName: displayName,
      avatarUrl: avatarUrl,
      emailAddress: emailAddress,
      inviteStatus: inviteStatus
    });

    if (type !== 'email') {
      // Check if we need to capture the email address
      apiClient.priv
        .get('/check-invite', { type: type, externalId: externalId })
        .then(function() {
          invite.set({
            inviteStatus: INVITE_STATUS_READY
          });
        })
        .catch(function() {
          invite.set('inviteStatus', INVITE_STATUS_NEEDS_EMAIL);
        });
    }

    return invite;
  },

  /**
   * Returns true if manual entry is required for some email addresses
   */
  hasInvitesRequiringEmailEntry: function() {
    // Are all invites set to 'ready?'
    return this.invites.some(inviteNeedsEmailPredicate);
  },

  getSecurityData: function() {
    var githubInfo = this.getGithubProjectInfo();
    if (githubInfo && githubInfo.type) {
      return {
        type: githubInfo.type,
        linkPath: githubInfo.linkPath
      };
    }

    return undefined; // No security info
  },

  getInviteData: function() {
    return this.invites.map(function(item) {
      var attributes = item.attributes;
      return {
        type: attributes.type,
        externalId: attributes.externalId,
        emailAddress: attributes.emailAddress
      };
    });
  },

  getSerializedCreateData: function() {
    var security = this.getSecurityData();
    var invites = this.getInviteData();

    return {
      name: this.get('communityName'),
      uri: this.get('communitySlug'),
      security: security,
      invites: invites,
      addBadge: this.get('allowBadger'),
      allowTweeting: true
    };
  },

  refreshCollection: function(collection, data) {
    data.cb = Date.now();

    return new Promise(function(resolve, reject) {
      collection.fetch({
        reset: true,
        data: data,
        success: function() {
          resolve();
        },
        error: reject
      });
    });
  },

  refreshGitHubCollections: function(options) {
    var resetOrgs = !options;
    var resetRepos = !options || options.repo;
    return Promise.all([
      resetOrgs && this.refreshCollection(this.orgs, {}),
      resetRepos && this.refreshCollection(this.repos, { type: 'admin' })
    ]);
  },

  findGitHubObjectForSlug: function(slug) {
    if (!slug) {
      return {
        githubOrgId: null,
        githubRepoId: null
      };
    }

    slug = slug.toLowerCase();

    // TODO: Why does this match the first item always?
    var matchingOrgItem = this.orgs.filter(function(org) {
      return (org.get('name') || '').toLowerCase() === slug;
    })[0];

    if (matchingOrgItem) {
      return {
        githubOrgId: matchingOrgItem.get('id'),
        githubRepoId: null
      };
    }

    var matchingRepoItem = this.repos.filter(function(repo) {
      return (repo.get('uri') || '').toLowerCase() === slug;
    })[0];

    if (matchingRepoItem) {
      return {
        githubOrgId: null,
        githubRepoId: matchingRepoItem.get('id')
      };
    }

    return {
      githubOrgId: null,
      githubRepoId: null
    };
  },

  updateGitHubInfoToMatchSlug: function() {
    if (this.get('isUsingExplicitGitHubProject')) return;
    var communitySlug = this.get('communitySlug');
    var githubInfo = this.findGitHubObjectForSlug(communitySlug);
    this.set(githubInfo);
  }
});

// Static Methods
CommunityCreateModel.inviteNeedsEmailPredicate = inviteNeedsEmailPredicate;

module.exports = CommunityCreateModel;
