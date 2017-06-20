"use strict";

var Promise = require('bluebird');
var uuid = require('node-uuid');
var User = require('gitter-web-persistence').User;
var OAuthAccessToken = require('gitter-web-persistence').OAuthAccessToken;
var OAuthClient = require('gitter-web-persistence').OAuthClient;
var fixtureUtils = require('./fixture-utils');
var debug = require('debug')('gitter:tests:test-fixtures');
var integrationFixtures = require('./integration-fixtures');

var userCounter = 0;

function createUser(fixtureName, f) {
  debug('Creating %s', fixtureName);

  var preremove = null;

  if (f === '#integrationUser1') {
    var integrationUsername = integrationFixtures.GITTER_INTEGRATION_USERNAME;
    var githubToken = integrationFixtures.GITTER_INTEGRATION_USER_SCOPE_TOKEN;

    f = {
      githubToken: githubToken,
      accessToken: 'web-internal'
    }

    if (integrationUsername) {
      f.username = integrationFixtures.GITTER_INTEGRATION_USERNAME;
      preremove = function() {
        return User.remove({ username: integrationFixtures.GITTER_INTEGRATION_USERNAME });
      }
    }
  }

  function possibleGenerate(key, fn) {
    if (f.hasOwnProperty(key)) {
      if (f[key] === true) {
        return fn();
      } else {
        return f[key];
      }
    } else {
      return fn()
    }
  }

  var doc = {
    identities: f.identities,
    displayName: possibleGenerate('displayName', fixtureUtils.generateName),
    githubId: possibleGenerate('githubId', fixtureUtils.generateGithubId),
    githubToken: possibleGenerate('githubToken', fixtureUtils.generateGithubToken),
    username: possibleGenerate('username', fixtureUtils.generateUsername),
    gravatarImageUrl: f.gravatarImageUrl,
    state: f.state || undefined,
    staff: f.staff || false
  };

  debug('Creating user %s with %j', fixtureName, doc);

  var promise = Promise.try(function() {
      if (preremove) {
        return preremove();
      }
    })
    .then(function() {
      return User.create(doc);
    })

  if (f.accessToken) {
    promise = promise.tap(function(user) {
      return OAuthClient.findOne({ clientKey: f.accessToken })
        .then(function(client) {
          if (!client) throw new Error('Client not found clientKey=' + f.accessToken);

          var token = '_test_' + uuid.v4();
          var doc = {
            token: token,
            userId: user._id,
            clientId: client._id,
            expires: new Date(Date.now() + 60 * 60 * 1000)
          };
          debug('Creating access token for %s with %j', fixtureName, doc);
          return OAuthAccessToken.create(doc)
            .then(function() {
              user.accessToken = token;
            });
        });
    });
  }

  return promise;
}

function createExtraUsers(expected, fixture, key) {
  var obj = expected[key];
  var users = [];

  if (obj.user) {
    // topics, replies and comments
    users.push(obj.user);
  }

  if (obj.users) {
    if (!Array.isArray(obj.users)) {
      obj.users = [obj.users];
    }

    users = users.concat(obj.users);
  }

  var extraMembers = obj.securityDescriptor && obj.securityDescriptor.extraMembers;
  if (extraMembers) {
    if (!Array.isArray(extraMembers)) {
      extraMembers = [extraMembers];
    }

    users = users.concat(extraMembers);
  }

  var extraAdmins = obj.securityDescriptor && obj.securityDescriptor.extraAdmins;
  if (extraAdmins) {
    if (!Array.isArray(extraAdmins)) {
      extraAdmins = [extraAdmins];
    }

    users = users.concat(extraAdmins);
  }

  return Promise.map(users, function(user, index) {
      if (typeof user === 'string') {
        if (expected[user]) return; // Already specified at the top level

        expected[user] = {};
        return createUser(user, {}).then(function(createdUser) {
          fixture[user] = createdUser;
        });
      }

      var fixtureName = 'user' + (++userCounter);
      obj.users[index] = fixtureName;
      expected[fixtureName] = user;

      debug('creating extra user %s', fixtureName);

      return createUser(fixtureName, user)
        .then(function(user) {
          fixture[fixtureName] = user;
        });

    })
    .then(function() {
      // now try and fill in the ones specified at the top level
      // (This applies to topics, replies and comments)

      var obj = expected[key];
      var user = obj.user;

      if (!user) return;

      if (typeof user === 'string' && fixture[user]) {
        // Already specified at the top level, so copy it
        obj.user = fixture[user];
      }
    });
}

function createUsers(expected, fixture) {
  return Promise.map(Object.keys(expected), function(key) {
    if (key.match(/^user/)) {
      return createUser(key, expected[key])
        .then(function(user) {
          fixture[key] = user;
        });
    }

    return null;
  })
  .then(function() {
    // only create the extra ones afterwards, otherwise we'll create
    // duplicate users before the ones above got saved and then they won't
    // link back to the same objects.
    return Promise.map(Object.keys(expected), function(key) {
      if (key.match(/^(troupe|group|forum|topic|reply|comment)/)) {
        return createExtraUsers(expected, fixture, key);
      }

      return null;
    });
  });
}

module.exports = createUsers;
