'use strict';

var Promise = require('bluebird');
var GitHubMeService = require('gitter-web-github').GitHubMeService;
var _ = require('lodash');
var isGitHubUser = require('gitter-web-identity/lib/is-github-user');

async function getAdminOrgsForUser(user) {
  const meService = new GitHubMeService(user);
  return meService.getOrgs();
}

function githubOrgAdminDiscovery(user) {
  if (!isGitHubUser(user)) return;

  return getAdminOrgsForUser(user).then(function(orgs) {
    if (!orgs || !orgs.length) return;

    var linkPaths = _.map(orgs, function(org) {
      return org.login;
    });

    var externalIds = _.map(orgs, function(org) {
      return org.id ? String(org.id) : null;
    });

    externalIds = _.filter(externalIds, Boolean);

    return {
      type: 'GH_ORG',
      linkPath: linkPaths,
      externalId: externalIds.length ? externalIds : null
    };
  });
}

module.exports = Promise.method(githubOrgAdminDiscovery);
module.exports.getAdminOrgsForUser = getAdminOrgsForUser;
