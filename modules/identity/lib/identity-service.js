'use strict';

var Promise = require('bluebird');
var Identity = require('gitter-web-persistence').Identity;
var assert = require('assert');

var GITHUB_PROVIDER_KEY = 'github';

// TODO: improve this
function isGitHubUser(user) {
  return user.githubUserToken || user.githubToken || user.githubId;
}

/**
 * If a user is a github user, returns a fake identity
 */
function castUserAsGitHubIdentity(user) {
  if (isGitHubUser(user)) {
    return {
      provider: GITHUB_PROVIDER_KEY,
      providerKey: user.githubId,
      username: user.username,
      displayName: user.displayName,
      email: null,
      accessToken: user.githubUserToken,
      refreshToken: null,
      accessTokenSecret: null,
      upgradedAccessToken: user.githubToken,
      scopes: user.githubScopes,
      avatar: user.gravatarImageUrl
    };
  }

  return null;
}

/**
 * Given a user and a provider, returns an identity to the user
 * Returns the identity or null if the user doesn't have the
 * requested identity
 *
 * @return {Promise} Promise of the identity
 */
var getIdentityForUser = Promise.method(function(user, provider) {
  if (!user) return null;

  var cachedIdentities = user._cachedIdentities;

  if (!cachedIdentities) {
    cachedIdentities = user._cachedIdentities = {};
  } else if (cachedIdentities[provider]) {
    return cachedIdentities[provider];
  }

  var query = cachedIdentities[provider] = findIdentityForUser(user._id, provider);
  return query;
});

/**
 * Given a user and a provider, returns an identity
 */
var findIdentityForUser = Promise.method(function(user, provider) {
  assert(provider, 'provider required');

  if (!user) return null;

  // Special case for GitHub, for now
  // in future, github will just use the same scheme as the other providers
  if (provider === GITHUB_PROVIDER_KEY) {
    return castUserAsGitHubIdentity(user);
  }

  return Identity.findOne({ userId: user._id, provider: provider }, { _id: 0, userId: 0, __v: 0 })
    .lean()
    .exec();
});

/*
*/
/**
 * List all the identities for a user

 * NOTE: At present this is unreliable for finding all the identities for a user,
 * because it doesn't contain any GitHub identities. In order to know if a user is
 * a GitHub user you can sorta get away with just the username at present, but you
 * really need (pretty much) the full user object to be sure and to get any useful
 * info out. So be careful.
 */
var listForUser = Promise.method(function (user) {
  if (!user) return [];

  if (isGitHubUser(user)) {
    return [castUserAsGitHubIdentity(user)];
  }

  if (user._cachedIdentityList) {
    // This is boomaclart
    return user._cachedIdentityList;
  }

  var userId = user._id;

  var query = user._cachedIdentityList = Identity.find({ userId: userId }, { _id: 0, userId: 0, __v: 0 })
    .lean()
    .exec();

  return query;
});

/**
 * Returns a list of provider keys for a user
 *
 * NOTE: right now you can only have one identity and this takes advantage
 * of that, but in future this will have to be updated so it doesn't return
 * early and instead appends them together.
 */
var listProvidersForUser = Promise.method(function(user) {
  if (!user) return [];

  if (isGitHubUser(user)) {
    return ['github'];
  }

  if (user._cachedIdentityList) {
    // This is boomaclart
    return Object.keys(user._cachedIdentityList);
  }

  return Identity.distinct('provider', { userId: user._id })
    .exec();
});

module.exports = {
  getIdentityForUser: getIdentityForUser,
  listForUser: listForUser,
  listProvidersForUser: listProvidersForUser
};
