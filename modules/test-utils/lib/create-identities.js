"use strict";

var Promise = require('bluebird');
var Identity = require('gitter-web-persistence').Identity;
var debug = require('debug')('gitter:tests:test-fixtures');

function createIdentity(fixtureName, f) {
  debug('Creating %s', fixtureName);

  return Identity.create({
    userId: f.userId,
    provider: f.provider,
    providerKey: f.providerKey,
    username: f.username,
    displayName: f.displayName,
    email: f.email,
    accessToken: f.accessToken,
    refreshToken: f.refreshToken,
    avatar: f.avatar
  });
}

function createIdentities(expected, fixture) {
  return Promise.map(Object.keys(expected), function(key) {
    if (key.match(/^identity/)) {
      var expectedIdentity = expected[key];

      expectedIdentity.userId = fixture[expectedIdentity.user]._id;

      return createIdentity(key, expectedIdentity)
        .then(function(identity) {
          fixture[key] = identity;

          // Add the identity back on the user object
          fixture[expectedIdentity.user].identities = (fixture[expectedIdentity.user].identities || []).concat({
            provider: identity.provider,
            providerKey: identity.providerKey
          });
        });
    }

    return null;
  });
}

module.exports = createIdentities;
