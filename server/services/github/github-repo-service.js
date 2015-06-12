"use strict";

var wrap = require('./github-cache-wrapper');
var tentacles = require('./tentacles-client');
var userTokenSelector = require('./user-token-selector').full;
var githubMediaTypes = require('./github-media-types');
var appEvents = require('../../app-events');

function GitHubRepoService(user) {
  this.user = user;
  this.accessToken = userTokenSelector(user);
}


/**
 * Returns the information about the specified repo
 * @return the promise of information about a repo
 */
 GitHubRepoService.prototype.getRepo = function(repo) {
  return tentacles.repo.get(repo, { accessToken: this.accessToken })
    .then(function(result) {
      if (!result) return result;
      if (result.full_name && result.full_name !== repo) {
        appEvents.repoRenameDetected(repo,result.full_name);
      }
      return result;
    });
};

/**
 *
 */
GitHubRepoService.prototype.isCollaborator = function(repo, username) {
  return tentacles.repoCollaborator.checkForUser(repo, username, { accessToken: this.accessToken });
};

/**
 *
 */
 GitHubRepoService.prototype.getCollaborators = function(repo) {
  return tentacles.repoCollaborator.list(repo, { accessToken: this.accessToken });
};

/**
 *
 */
GitHubRepoService.prototype.getCommits = function(repo, options) {
  return tentacles.repoCommit.list(repo, { firstPageOnly: options.firstPage, accessToken: this.accessToken });
};


/**
 *  Returns repo stargazers
 */
 GitHubRepoService.prototype.getStargazers = function(repo) {
  return tentacles.starring.listForRepo(repo, { accessToken: this.accessToken });
};

/**
 * Returns a promise of the issues for a repo
 */
GitHubRepoService.prototype.getIssues = function(repo) {
  return tentacles.issue.listForRepo(repo, { query: { state: 'all' }, accessToken: this.accessToken })
    .then(function(returnedIssues) {
      var issues = [];
      returnedIssues.forEach(function(issue) {
        issues[issue.number] = issue;
      });
      return issues;
    });
};


GitHubRepoService.prototype.getRecentlyStarredRepos = function() {
  return tentacles.starring.listForAuthUser({ firstPageOnly: true, query: { per_page: 100 }, accessToken: this.accessToken });
};

GitHubRepoService.prototype.getWatchedRepos = function() {
  return tentacles.watching.listForAuthUser({ accessToken: this.accessToken });
};

GitHubRepoService.prototype.getAllReposForAuthUser = function() {
  return tentacles.repo.listForAuthUser({ accessToken: this.accessToken, headers: { Accept: githubMediaTypes.MOONDRAGON } });
};

/** TODO: deprecated */
GitHubRepoService.prototype.getReposForUser = function(username, options) {
  return tentacles.repo.listForUser(username, {
    firstPageOnly: options && options.firstPage,
    accessToken: this.accessToken,
    headers: { Accept: githubMediaTypes.MOONDRAGON }
  });
};


module.exports = wrap(GitHubRepoService, function() {
  return [this.accessToken || ''];
});
