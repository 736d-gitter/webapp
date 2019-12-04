'use strict';

var _ = require('lodash');
const urlJoin = require('url-join');

var GithubMe = require('gitter-web-github').GitHubMeService;
var gitHubEmailAddressService = require('./github-email-address-service');
var gitHubProfileService = require('./github-profile-service');

function GitHubBackend(user, identity) {
  this.user = user;
  this.identity = identity;
}

GitHubBackend.prototype.getEmailAddress = function(preferStoredEmail) {
  return gitHubEmailAddressService(this.user, preferStoredEmail);
};

GitHubBackend.prototype.findOrgs = function() {
  var user = this.user;
  var ghUser = new GithubMe(user);

  if (!ghUser.accessToken) return [];

  return ghUser.getOrgs().then(function(ghOrgs) {
    // TODO: change these to be in a standard internal format
    return ghOrgs.map(org => {
      return {
        ...org,
        backend: 'github',
        absoluteUri: urlJoin('https://github.com', org.name)
      };
    });
  });
};

GitHubBackend.prototype.getProfile = function() {
  // the minimum response
  var profile = { provider: 'github' };
  return gitHubProfileService(this.user).then(function(gitHubProfile) {
    _.extend(profile, gitHubProfile);
    return profile;
  });
};

module.exports = GitHubBackend;
