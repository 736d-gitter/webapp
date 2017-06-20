/*jshint globalstrict:true, trailing:false, unused:true, node:true */
/*global describe:true, it:true, before:true, after:true */
"use strict";

var testRequire        = require('./../test-require');
var fixtureLoader      = require('../test-fixtures');
var assert             = testRequire("assert");
var Q                  = require('q');
var fixture2 = {};

describe("User Service", function() {

  before(fixtureLoader(fixture2, {
    user1: { username: true },
    user2: { },
    user3: { }
  }));

  it('should allow two users with the same githubId to be created at the same moment, but only create a single account', function(done) {
    var userService = testRequire("./services/user-service");

    var githubId = fixture2.generateGithubId();
    Q.all([
      userService.findOrCreateUserForGithubId({ githubId: githubId, username: fixture2.generateUsername(), githubToken: fixture2.generateGithubToken() }),
      userService.findOrCreateUserForGithubId({ githubId: githubId, username: fixture2.generateUsername(), githubToken: fixture2.generateGithubToken() })
      ])
      .spread(function(user1, user2) {
        assert.strictEqual(user1.id, user2.id);
        assert.strictEqual(user1.confirmationCode, user2.confirmationCode);
      })
      .nodeify(done);
  });

  it('should be able to create a \'ghost\' user using his username #slow', function(done) {
    var userService = testRequire("./services/user-service");

    userService.createInvitedUser('node-gitter')
    .then(function(user) {
      assert.equal(user.username,'node-gitter');
      assert.equal(user.state, 'INVITED');
    })
    .nodeify(done);
  });

  it('should create new users', function(done) {

    var userService = testRequire("./services/user-service");
    var persistence = testRequire("./services/persistence-service");
    return persistence.User.findOneAndRemoveQ({ githubId: - 1})
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
