'use strict';

var testRequire = require('../../test-require');
var accessTokenProvider = testRequire('./services/tokens/access-token-provider');
var mongoUtils = testRequire('./utils/mongo-utils');
var Q = require('q');
var assert = require('assert');

describe('access-token-provider', function() {

  require('./provider-tests-common-full')(accessTokenProvider);

  describe('idempotency #slow', function() {

    // Set to skip until this problematic test can be
    // sorted out. See https://github.com/troupe/gitter-webapp/issues/882
    // AN 25 Jan 2016
    it.skip('should be idempotent', function() {
      var userId = mongoUtils.getNewObjectIdString();
      var clientId = mongoUtils.getNewObjectIdString();

      return Q.all([
        accessTokenProvider.getToken(userId, clientId),
        accessTokenProvider.getToken(userId, clientId),
        accessTokenProvider.getToken(userId, clientId),
        accessTokenProvider.getToken(userId, clientId),
        accessTokenProvider.getToken(userId, clientId)
      ]).then(function(items) {
        var firstToken = items[0];

        assert(items.every(function(token) {
          return token === firstToken;
        }));
      });

    });

  });

});
