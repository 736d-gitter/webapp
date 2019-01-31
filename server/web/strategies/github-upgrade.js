'use strict';

var env = require('gitter-web-env');
var config = env.config;
var logger = env.logger;
var GitHubStrategy = require('@gitterhq/passport-github').Strategy;
var TokenStateProvider = require('@gitterhq/passport-oauth2').TokenStateProvider;
var callbackUrlBuilder = require('./callback-url-builder');

function githubUpgradeCallback(req, accessToken, refreshToken, params, _profile, done) {
  var requestedScopes = params.scope.split(/,/);
  var scopeHash = requestedScopes.reduce(function(memo, v) {
    memo[v] = true;
    return memo;
  }, {});

  req.user.githubToken = accessToken;
  req.user.githubScopes = scopeHash;

  req.user.save(function(err) {
    if (err) {
      logger.error('passport: user save failed: ' + err, { exception: err });
      return done(err);
    }

    logger.info('passport: User updated with token');
    return done(null, req.user);
  });
}

var statePassphrase = config.get('github:statePassphrase');

var githubUpgradeStrategy = new GitHubStrategy(
  {
    clientID: config.get('github:client_id'),
    clientSecret: config.get('github:client_secret'),
    callbackURL: callbackUrlBuilder(),
    stateProvider: statePassphrase && new TokenStateProvider({ passphrase: statePassphrase }),
    skipUserProfile: true,
    passReqToCallback: true
  },
  githubUpgradeCallback
);

githubUpgradeStrategy.name = 'github_upgrade';

module.exports = githubUpgradeStrategy;
