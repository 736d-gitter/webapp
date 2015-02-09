"use strict";

var WEB_INTERNAL_CLIENT_KEY = 'web-internal';
var env    = require('../utils/env');
var nconf  = env.config;
var logger = env.logger;

var persistenceService = require("./persistence-service");
var Q                  = require('q');
var userService        = require('./user-service');
var tokenProvider      = require('./tokens/');

var ircClientId;

/* Load webInternalClientId once */
var webClientPromise = persistenceService.OAuthClient.findOneQ({ clientKey: WEB_INTERNAL_CLIENT_KEY })
  .then(function(oauthClient) {
    if(!oauthClient) throw new Error("Unable to load internal client id.");
    oauthClient = oauthClient.toJSON();
    oauthClient.id = oauthClient._id && oauthClient._id.toString();

    return oauthClient;
  });
webClientPromise.done();

var ircClientIdPromise = persistenceService.OAuthClient.findOneQ({ clientKey: nconf.get('irc:clientKey') })
  .then(function(oauthClient) {
    if(!oauthClient) throw new Error("Unable to load IRC client id.");

    ircClientId = oauthClient._id;
    return ircClientId;
  });
// Fail on error
ircClientIdPromise.done();

exports.findClientById = function(id, callback) {
  persistenceService.OAuthClient.findById(id, callback);
};

// this is called when a user actively logs in via oauth
exports.saveAuthorizationCode = function(code, client, redirectUri, user, callback) {
  var authCode = new persistenceService.OAuthCode({
      code: code,
      clientId: client.id,
      redirectUri: redirectUri,
      userId: user.id
  });
  authCode.save(callback);
};

exports.findAuthorizationCode = function(code, callback) {
  persistenceService.OAuthCode.findOne({ code: code }, callback);
};

/**
 * Turn a token into a user/token/client.
 *
 * Returns { user / client / accessToken } hash. If the token is for an anonymous user,
 * user is null;
 */
exports.validateAccessTokenAndClient = function(token, callback) {
  return tokenProvider.validateToken(token)
    .then(function(result) {
      if (!result) {
        logger.warn('Invalid token presented: ', { token: token });
        return null; // code invalid
      }

      var userId = result[0];   // userId CAN be null
      var clientId = result[1];

      if (!clientId) {
        logger.warn('Invalid token presented (no client): ', { token: token });
        return null; // code invalid
      }

      // TODO: cache this stuff
      return Q.all([
          persistenceService.OAuthClient.findByIdQ(clientId),
          userId && userService.findById(userId)
        ])
        .spread(function (client, user) {
          if(!client) {
            logger.warn('Invalid token presented (client not found): ', { token: token, clientId: clientId });
            return null;
          }

          if(userId && !user) {
           logger.warn('Invalid token presented (user not found): ', { token: token, userId: userId });
           return null;
          }

          return { user: user, client: client };
        });

    })
    .nodeify(callback);
};

exports.removeAllAccessTokensForUser = function(userId, callback) {
  return persistenceService.OAuthAccessToken.removeQ({ userId: userId })
    .nodeify(callback);
};

exports.findClientByClientKey = function(clientKey, callback) {
  persistenceService.OAuthClient.findOne({ clientKey: clientKey }, callback);
};

function findOrCreateToken(userId, clientId, callback) {
  if(!clientId) return Q.reject('clientId required').nodeify(callback);

  return tokenProvider.getToken(userId, clientId)
    .nodeify(callback);
}
exports.findOrCreateToken = findOrCreateToken;

// TODO: move some of this functionality into redis for speed
// TODO: make the web tokens expire
exports.findOrGenerateWebToken = function(userId, callback) {
  return webClientPromise
    .then(function(client) {
      var clientId = client.id;

      return tokenProvider.getToken(userId, clientId)
        .then(function(token) {
          return [token, client];
        });
    })
    .nodeify(callback);
};

exports.generateAnonWebToken = function(callback) {
  return webClientPromise
    .then(function(client) {
      var clientId = client.id;

      return tokenProvider.getToken(null, clientId)
        .then(function(token) {
          return [token, client];
        });
    })
    .nodeify(callback);
};

exports.findOrGenerateIRCToken = function(userId, callback) {
  return ircClientIdPromise
    .then(function(clientId) {
      return tokenProvider.getToken(userId, clientId);
    })
    .nodeify(callback);
};

exports.testOnly = {
  invalidateCache: function() {
    return tokenProvider.testOnly.invalidateCache();
  }
};

