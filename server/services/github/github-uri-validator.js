/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var GitHubOrgService = require('./github-org-service');
var GitHubRepoService = require('./github-repo-service');
var Q = require('q');

/**
 * Given a uri, is it a valid repo or valid org?
 * @returns promise of ORG / REPO or null
 */
function validateUri(user, uri) {
  var parts = uri.split('/');
  if(parts.length == 1) {
    /** Its a user or org.
     *  We only need to check if it's an org because we'll
     *  already know if its a registered user and won't be
     *  in this code
     **/
    var orgService = new GitHubOrgService(user);
    return orgService.getOrg(uri)
      .then(function(org) {
        if(org) return ['ORG', org.login];

        return;
      });
  }

  if(parts.length == 2) {
    /* Its a repo */
    var repoService = new GitHubRepoService(user);
    return repoService.getRepo(uri)
      .then(function(repo) {
        if(repo) return ['REPO', repo.full_name];

        return;
      });
  }

  return Q.resolve();
}

module.exports = validateUri;