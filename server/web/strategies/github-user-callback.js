"use strict";

var env = require('gitter-web-env');
var stats = env.stats;
var logger = env.logger;
var errorReporter = env.errorReporter;

var moment = require('moment');
var _ = require('underscore');
var GitHubMeService = require('gitter-web-github').GitHubMeService;
var userService = require('../../services/user-service');
var userSettingsService = require('../../services/user-settings-service');
var gaCookieParser = require('../../utils/ga-cookie-parser');
var useragentTagger = require('../../utils/user-agent-tagger');
var mixpanel = require('../../web/mixpanelUtils');
var extractGravatarVersion = require('../../utils/extract-gravatar-version');
var emailAddressService = require('../../services/email-address-service');
var debug = require('debug')('gitter:passport');


function updateUser(req, accessToken, user, githubUserProfile, done) {
  var googleAnalyticsUniqueId = gaCookieParser(req);

  // TODO: split out? can non-github users be invited?
  // If the user was in the DB already but was invited, notify stats services
  if (user.isInvited()) {
    // IMPORTANT: The alias can only happen ONCE. Do not remove.
    stats.alias(mixpanel.getMixpanelDistinctId(req.cookies), user.id, function() {
      stats.event("new_user", {
        userId: user.id,
        method: 'github_oauth',
        username: user.username,
        source: 'invited',
        googleAnalyticsUniqueId: googleAnalyticsUniqueId
      });
    });
  }

  user.username         = githubUserProfile.login;
  user.displayName      = githubUserProfile.name || githubUserProfile.login;
  user.gravatarImageUrl = githubUserProfile.avatar_url;
  user.githubId         = githubUserProfile.id;
  var gravatarVersion   = extractGravatarVersion(githubUserProfile.avatar_url);
  if (gravatarVersion) {
    user.gravatarVersion = extractGravatarVersion(githubUserProfile.avatar_url);
  }
  user.githubUserToken  = accessToken;
  user.state            = undefined;

  user.save(function(err) {
    if (err) logger.error("Failed to update GH token for user ", user.username);

    // Tracking
    var properties = useragentTagger(req.headers['user-agent']);

    emailAddressService(user)
      .then(function(email) {
        user.email = email;
        stats.userUpdate(user, properties);
      });

    // TODO: split out? more tracking
    stats.event("user_login", _.extend({
      userId: user.id,
      method: 'github_oauth',
      username: user.username
    }, properties));

    // TODO: split out to updateUserLocale()
    if (req.i18n && req.i18n.locale) {
      userSettingsService.setUserSettings(user.id, 'lang', req.i18n.locale)
        .catch(function(err) {
          logger.error("Failed to save lang user setting", { userId: user.id, lang: req.i18n.locale, exception: err });
        });
    }

    req.logIn(user, function(err) {
      if (err) { return done(err); }

      // Remove the old token for this user
      req.accessToken = null;
      return done(null, user);
    });
  });
}

function addUser(req, accessToken, githubUserProfile, done) {
  var googleAnalyticsUniqueId = gaCookieParser(req);

  var githubUser = {
    username:           githubUserProfile.login,
    displayName:        githubUserProfile.name || githubUserProfile.login,
    emails:             githubUserProfile.email ? [githubUserProfile.email] : [],
    gravatarImageUrl:   githubUserProfile.avatar_url,
    gravatarVersion:    extractGravatarVersion(githubUserProfile.avatar_url),
    githubUserToken:    accessToken,
    githubId:           githubUserProfile.id,
  };

  debug('About to create GitHub user %j', githubUser);

  userService.findOrCreateUserForGithubId(githubUser, function(err, user) {
    if (err) return done(err);

    debug('Created GitHub user %j', user.toObject());

    // TODO: split out into setLocale(req, user) or something
    // NOTE: this happens async in the background and next steps don't wait for
    // it. Is that intentional?
    // Save the locale of the new user
    if (req.i18n && req.i18n.locale) {
      userSettingsService.setUserSettings(user.id, 'lang', req.i18n.locale)
        .catch(function(err) {
          logger.error("Failed to save lang user setting", { userId: user.id, lang: req.i18n.locale, exception: err });
        });
    }

    // TODO: split out?
    // IMPORTANT: The alias can only happen ONCE. Do not remove.
    stats.alias(mixpanel.getMixpanelDistinctId(req.cookies), user.id, function(err) {
      if (err) logger.error('Error aliasing user:', { exception: err });

      // TODO: make emailAddressService aware of different providers
      emailAddressService(user)
        .then(function(email) {
          user.email = email;

          stats.userUpdate(user);

          stats.event("new_user", {
            userId: user.id,
            email: email,
            method: 'github_oauth',
            username: user.username,
            source: req.session.source,
            googleAnalyticsUniqueId: googleAnalyticsUniqueId
          });
        });

      // TODO: will we need something similar to this for non-github users?
      // Flag the user as a new github user if they've created
      // their account in the last two hours
      var githubUserAgeHours;
      if (githubUserProfile.created_at) {
        var createdAt = moment(githubUserProfile.created_at);
        var duration = moment.duration(Date.now() - createdAt.valueOf());
        githubUserAgeHours = duration.asHours();
      }
      if (githubUserAgeHours < 2) {
        stats.event("new_github_user", {
          userId: user.id,
          username: user.username,
          googleAnalyticsUniqueId: googleAnalyticsUniqueId
        });
      }
    });

    req.logIn(user, function(err) {
      if (err) { return done(err); }
      return done(null, user);
    });
  });
}

function githubUserCallback(req, accessToken, refreshToken, params, _profile, done) {
  var githubMeService = new GitHubMeService({ githubUserToken: accessToken });
  var githubUserProfile;
  return githubMeService.getUser()
    .then(function(_githubUserProfile) {
      githubUserProfile = _githubUserProfile;
      return userService.findByGithubIdOrUsername(githubUserProfile.id, githubUserProfile.login)
    })
    .then(function(user) {
      // TODO: split out into addSignupEvent(req)
      if (req.session && (!user || user.isInvited())) {
        var events = req.session.events;
        if (!events) {
          events = [];
          req.session.events = events;
        }
        events.push('new_user_signup');
      }

      // Update an existing user
      if (user) {
        return updateUser(req, accessToken, user, githubUserProfile, done);
      } else {
        return addUser(req, accessToken, githubUserProfile, done);
      }
    })
    .catch(function(err) {
      // TODO: split out into oauthErrorHandler
      errorReporter(err, { oauth: "failed" }, { module: 'passport' });
      stats.event("oauth_profile.error");
      logger.error('Error during oauth process. Unable to obtain user profile.', err);
      return done(err);
    });
}

module.exports = githubUserCallback;
