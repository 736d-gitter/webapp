/* jshint node:true, unused:strict */
/* global describe:true, it:true */
"use strict";

var testRequire = require('../test-require');
var assert = require("assert");
var Q = require('q');

var fakeUser = { username: 'fake-user', id: 'abc123' };

describe('github-gitter-user-search', function() {

  it('puts gitter connections above strangers', function(done) {

    var search = createSearchWithStubData({
      gitter: [{ username: 'gitter-friend', id: '123456'}],
      github: [{ login: 'some-github-user'}],
      userService: { 'gitter-friend': '123456' }
    });

    search('something', fakeUser).then(function(data) {
      var list = getResults(data);

      assert.deepEqual(list, [
        { username: 'gitter-friend', id: '123456'},
        { username: 'some-github-user' }
      ]);

    }).nodeify(done);

  });

  it('removes duplicate github users', function(done) {

    var search = createSearchWithStubData({
      gitter: [{ username: 'gitter-friend', id: '123456'}],
      github: [{ login: 'gitter-friend'}],
      userService: { 'gitter-friend': '123456' }
    });

    search('something', fakeUser).then(function(data) {
      var list = getResults(data);

      assert.deepEqual(list, [
        { username: 'gitter-friend', id: '123456'}
      ]);

    }).nodeify(done);

  });

  it('doesnt include yourself', function(done) {

    var search = createSearchWithStubData({
      gitter: [{ username: 'me', id: '123456' }],
      github: [{ login: 'me'}],
      userService: { 'me': 'abc123' }
    });

    search('something', { username: 'me', id: '123456' }).then(function(data) {
      var list = getResults(data);

      assert.deepEqual(list, []);

    }).nodeify(done);

  });

  describe('adding gitter metatdata to github users', function() {

    it('adds metatdata to a single matching github user', function(done) {

      var search = createSearchWithStubData({
        gitter: [],
        github: [{ login: 'gitter-user'}],
        userService: { 'gitter-user': 'testid' }
      });

      search('include-self', fakeUser).then(function(data) {
        var list = getResults(data);

        assert.deepEqual(list, [
          { username: 'gitter-user', id: 'testid'}
        ]);

      }).nodeify(done);

    });

    it('handles sparse matches correctly', function(done) {

      var search = createSearchWithStubData({
        gitter: [],
        github: [{ login: 'not-on-gitter'}, { login: 'on-gitter'}],
        userService: { 'on-gitter': 'testid' }
      });

      search('something', fakeUser).then(function(data) {
        var list = getResults(data);

        assert.deepEqual(list, [
          { username: 'not-on-gitter' },
          { username: 'on-gitter', id: 'testid'}
        ]);

      }).nodeify(done);

    });

  });

  describe('end-to-end #slow', function() {
    var search, user;
    beforeEach(function() {
      search = testRequire('./services/github-gitter-user-search');
      user = { id: '54eb53c202281dd5f26fa58f', username: 'gittertestbot', githubToken: '***REMOVED***'};

    });

    it('should find users', function(done) {
      return search('Andrew Newdigate', user)
        .then(function(data) {
          assert(data.results.some(function(user) {
            return user.username == 'suprememoocow';
          }));
        })
        .nodeify(done);
    });

    it('should find with reserved words', function(done) {
      return search('AND', user)
        .then(function(data) {
          console.log(data);
        })
        .nodeify(done);
    });

  });

});

function createSearchWithStubData(data) {
  return testRequire.withProxies('./services/github-gitter-user-search', {
    './user-search-service': createFakeGitterSearch(data.gitter),
    './github/github-fast-search': createFakeGithubSearch(data.github),
    './user-service': createFakeUserService(data.userService)
  });
}

function createFakeGitterSearch(users) {
  return {
    searchForUsers: function() {
      return Q.resolve({ results: users });
    }
  };
}

function createFakeGithubSearch(users) {
  var FakeGithubSearch = function() {};
  FakeGithubSearch.prototype.findUsers = function() {
    return Q.resolve(users);
  };
  return FakeGithubSearch;
}

function createFakeUserService(usermap) {
  return {
    githubUsersExists: function() {
      return Q.resolve(usermap);
    },
    findByUsernames: function(usernames) {
      return Q.fcall(function() {
        return usernames.map(function(username) {
          return {
            id: usermap[username],
            username: username
          };
        });
      });
    }
  };
}

function getResults(data) {
  return data.results.map(function(user) {
    var newuser = {
      username: user.username,
    };

    if(user.id) {
      newuser.id = user.id;
    }
    return newuser;
  });
}
