'use strict';

var Promise = require('bluebird');
var StatusError = require('statuserror');

var userService = require('./user-service');
var troupeService = require('./troupe-service');
var groupService = require('gitter-web-groups/lib/group-service');
var validateGitHubUri = require('gitter-web-github').GitHubUriValidator;


function checkLocalUri(uri) {
  return Promise.join(
      // TODO: what about usernames with different case? Should we use a regex
      // rather? See create-owner-report.js for an example.
      userService.findByUsername(uri),
      groupService.findByUri(uri),
      troupeService.findByUri(uri),
      function(user, group, troupe) {
        return user || group || troupe;
      }
    );
}

function checkGitHubUri(user, uri) {
  //gh orgs or users
  return validateGitHubUri(user, uri)
    .then(function(githubInfo) {
      return !!githubInfo;
    });
}

function checkIfGroupUriExists(user, uri) {
  return Promise.try(function() {
      if (!uri) throw new StatusError(400);

      // group uris only, not rooms too
      if (uri.indexOf('/') !== -1) throw new StatusError(400);

      return Promise.join(
        checkLocalUri(uri),
        checkGitHubUri(user, uri),
        function(localUriExists, githubUriExists) {
          return !!(localUriExists || githubUriExists);
        });
    });
}

module.exports = checkIfGroupUriExists;
