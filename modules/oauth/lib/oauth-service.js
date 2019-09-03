'use strict';

const WEB_INTERNAL_CLIENT_KEY = 'web-internal';
const env = require('gitter-web-env');
const nconf = env.config;
const logger = env.logger;

const appEvents = require('gitter-web-appevents');
const persistenceService = require('gitter-web-persistence');
const Promise = require('bluebird');
const StatusError = require('statuserror');
const userService = require('gitter-web-users');
const tokenProvider = require('./tokens/');
const MongooseCachedLookup = require('./mongoose-cached-lookup');

var ircClientId;

var cachedClientLookup = new MongooseCachedLookup({ model: persistenceService.OAuthClient });

/* Load webInternalClientId once */
var webClientPromise = persistenceService.OAuthClient.findOne({
  clientKey: WEB_INTERNAL_CLIENT_KEY
})
  .exec()
  .then(function(oauthClient) {
    if (!oauthClient) throw new Error('Unable to load internal client id.');
    oauthClient = oauthClient.toJSON();
    oauthClient.id = oauthClient._id && oauthClient._id.toString();

    return oauthClient;
  });
webClientPromise.done();

var ircClientIdPromise = persistenceService.OAuthClient.findOne({
  clientKey: nconf.get('irc:clientKey')
})
  .exec()
  .then(function(oauthClient) {
    if (!oauthClient) throw new Error('Unable to load IRC client id.');

    ircClientId = oauthClient._id;
    return ircClientId;
  });

// Fail on error
ircClientIdPromise.done();

function deleteToken(token, callback) {
  return tokenProvider.deleteToken(token).nodeify(callback);
}

function findClientById(id, callback) {
  persistenceService.OAuthClient.findById(id, callback);
}

// this is called when a user actively logs in via oauth
function saveAuthorizationCode(code, client, redirectUri, user, callback) {
  var authCode = new persistenceService.OAuthCode({
    code: code,
    clientId: client.id,
    redirectUri: redirectUri,
    userId: user.id
  });
  authCode.save(callback);
}

function findAuthorizationCode(code) {
  return persistenceService.OAuthCode.findOne({ code: code });
}

function deleteAuthorizationCode(code) {
  return persistenceService.OAuthCode.remove({ code: code });
}

/**
 * Turn a token into a user/token/client.
 *
 * Returns { user / client / accessToken } hash. If the token is for an anonymous user,
 * user is null;
 */
function validateAccessTokenAndClient(token) {
  return tokenProvider.validateToken(token).then(function(result) {
    if (!result) {
      logger.warn('Invalid token presented: ', { token: token });
      return null; // code invalid
    }

    var userId = result[0]; // userId CAN be null
    var clientId = result[1];

    if (!clientId) {
      logger.warn('Invalid token presented (no client): ', { token: token });
      return null; // code invalid
    }

    // TODO: cache this stuff
    return Promise.join(
      cachedClientLookup.get(clientId),
      userId && userService.findById(userId),
      function(client, user) {
        if (!client) {
          logger.warn('Invalid token presented (client not found): ', {
            token: token,
            clientId: clientId
          });
          return null;
        } else if (client.revoked) {
          logger.warn('Token can not be accepted (client has been revoked): ', {
            token: token,
            clientId: clientId
          });

          // Sends a message to the websockets
          appEvents.tokenRevoked({
            userId: userId,
            token: token
          });

          var err = new StatusError(401);
          err.clientRevoked = true;
          throw err;
        }

        if (userId && !user) {
          logger.warn('Invalid token presented (user not found): ', {
            token: token,
            userId: userId
          });
          return null;
        }

        if (user && user.state === 'DISABLED') {
          return deleteToken(token).return(null);
        }

        return { user: user, client: client };
      }
    );
  });
}

function removeAllAccessTokensForUser(userId, callback) {
  return persistenceService.OAuthAccessToken.remove({ userId: userId })
    .exec()
    .nodeify(callback);
}

function findClientByClientKey(clientKey, callback) {
  return persistenceService.OAuthClient.findOne({ clientKey: clientKey })
    .exec()
    .asCallback(callback);
}

function findOrCreateToken(userId, clientId, callback) {
  if (!clientId) return Promise.reject(new Error('clientId required')).nodeify(callback);

  return tokenProvider.getToken(userId, clientId).nodeify(callback);
}

// TODO: move some of this functionality into redis for speed
// TODO: make the web tokens expire
function findOrGenerateWebToken(userId, callback) {
  return webClientPromise
    .then(function(client) {
      var clientId = client.id;

      return tokenProvider.getToken(userId, clientId).then(function(token) {
        return [token, client];
      });
    })
    .nodeify(callback);
}

function generateAnonWebToken(callback) {
  return webClientPromise
    .then(function(client) {
      var clientId = client.id;

      return tokenProvider.getToken(null, clientId).then(function(token) {
        return [token, client];
      });
    })
    .nodeify(callback);
}

function findOrGenerateIRCToken(userId, callback) {
  return ircClientIdPromise
    .then(function(clientId) {
      return tokenProvider.getToken(userId, clientId);
    })
    .nodeify(callback);
}

// eslint-disable-next-line complexity
function clientKeyIsInternal(clientKey) {
  switch (clientKey) {
    case 'web-internal': // The webapp
    case '1': // old OSX app
    case '2': // old Beta OSX app
    case '4': // old Troupe Notifier OSX app
    case '5': // old Troupe Notifier Beta OSX app
    case 'osx-desktop-prod':
    case 'windows-desktop-prod':
    case 'linux-desktop-prod':
    case 'osx-desktop-prod-v4':
    case 'windows-desktop-prod-v4':
    case 'linux-desktop-prod-v4':
    case 'android-prod':
    case 'ios-beta':
    case 'ios-beta-dev':
    case 'ios-prod':
    case 'ios-prod-dev':
      return true;
  }

  return false;
}

/**
 * In future we should add scopes to our client schema, rather than
 * doing this, which is horrible
 */
function isInternalClient(client) {
  if (!client) return false;
  if (!client.clientKey) return false;
  if (client.canSkipAuthorization) return true;

  return clientKeyIsInternal(client.clientKey);
}

module.exports = {
  findClientById: findClientById,
  saveAuthorizationCode: saveAuthorizationCode,
  findAuthorizationCode: findAuthorizationCode,
  deleteAuthorizationCode: deleteAuthorizationCode,
  validateAccessTokenAndClient: validateAccessTokenAndClient,
  removeAllAccessTokensForUser: removeAllAccessTokensForUser,
  findClientByClientKey: findClientByClientKey,
  findOrCreateToken: findOrCreateToken,
  findOrGenerateWebToken: findOrGenerateWebToken,
  generateAnonWebToken: generateAnonWebToken,
  findOrGenerateIRCToken: findOrGenerateIRCToken,
  deleteToken: deleteToken,
  isInternalClient: isInternalClient,
  testOnly: {
    invalidateCache: function() {
      return tokenProvider.testOnly.invalidateCache();
    }
  }
};
