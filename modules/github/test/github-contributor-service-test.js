/*global describe:true, it:true */
'use strict';

var _ = require('underscore');
var assert = require('assert');
var GithubContibutorService = require('..').GitHubContributorService;

describe('github-contributor-service #flakey #slow #github', function() {
  // These tests timeout at 10000 sometimes otherwise
  this.timeout(30000);

  it('members should detailed emailed', function(done) {
    var gh = new GithubContibutorService(null);

    gh.getContributors('faye/faye')
      .then(function(contributors) {
        assert(
          _.find(contributors, function(c) {
            return c.login === 'jcoglan';
          })
        );
      })
      .nodeify(done);
  });
});
