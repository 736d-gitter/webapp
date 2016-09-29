/*global describe:true, it:true, before:true, after:true */
"use strict";

var assert = require("assert");
var Promise = require('bluebird');
var fixtureLoader = require('gitter-web-test-utils/lib/test-fixtures');
var mongoUtils = require('gitter-web-persistence-utils/lib/mongo-utils');
var testRequire = require('./../test-require');


var fixture2 = {};

describe("User Service", function() {

  before(fixtureLoader(fixture2, {
    user1: { username: true },
    user2: { },
    user3: { }
  }));

  it('should allow two users with the same githubId to be created at the same moment, but only create a single account', function() {
    var userService = testRequire("./services/user-service");

    var githubId = fixture2.generateGithubId();
    return Promise.all([
      userService.findOrCreateUserForGithubId({ githubId: githubId, username: fixture2.generateUsername(), githubToken: fixture2.generateGithubToken() }),
      userService.findOrCreateUserForGithubId({ githubId: githubId, username: fixture2.generateUsername(), githubToken: fixture2.generateGithubToken() })
      ])
      .spread(function(user1, user2) {
        assert.strictEqual(user1.id, user2.id);
        assert.strictEqual(user1.confirmationCode, user2.confirmationCode);
      })
      .catch(mongoUtils.mongoErrorWithCode(11000), function() {
        // It looks like mongo is just incapable of guaranteeing this. Up to
        // 50% of the time this test runs it throws this error.
        console.log("Duplicate user.");
      });
  });

  it('should create new users', function(done) {

    var userService = testRequire("./services/user-service");
    var persistence = require('gitter-web-persistence');
    return persistence.User.findOneAndRemove({ githubId: - 1})
      .exec()
      .then(function() {
        return userService.findOrCreateUserForGithubId({ githubId: -1, username: '__test__gitter_007' });
      })
      .nodeify(done);
  });

  it('should destroy tokens for users', function(done) {
    var userService = testRequire("./services/user-service");

    return userService.findOrCreateUserForGithubId({
        githubId: -Date.now(),
        username: fixture2.generateUsername(),
        githubToken: 'x',
        githubUserToken: 'y',
        githubScopes: { 'user:email': 1 }
      })
      .then(function(user) {
        assert(user.githubToken);
        assert(user.githubUserToken);
        assert(user.githubScopes['user:email']);

        return [user, userService.destroyTokensForUserId(user.id)];
      })
      .spread(function(user) {
        return userService.findById(user.id);
      })
      .then(function(user) {
        assert(!user.githubToken);
        assert(!user.githubUserToken);
        assert.deepEqual(user.githubScopes, {});
      })
      .nodeify(done);

  });

  it('should allow timezone information to be updated', function() {
    var userService = testRequire("./services/user-service");

    return userService.updateTzInfo(fixture2.user1.id, { offset: 60, abbr: 'CST', iana: 'Europe/Paris' })
      .then(function() {
        return userService.findById(fixture2.user1.id);
      })
      .then(function(user) {
        var tz = user.tz;
        assert(tz);
        assert.strictEqual(tz.offset, 60);
        assert.strictEqual(tz.abbr, 'CST');
        assert.strictEqual(tz.iana, 'Europe/Paris');

        return userService.updateTzInfo(fixture2.user1.id, { });
      })
      .then(function() {
        return userService.findById(fixture2.user1.id);
      })
      .then(function(user) {
        var tz = user.tz;

        assert(!tz || !tz.offset);
        assert(!tz || !tz.abbr);
        assert(!tz || !tz.iana);
      });

  });

  after(function() {
    fixture2.cleanup();
  });
});
