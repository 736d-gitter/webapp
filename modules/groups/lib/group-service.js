'use strict';

var assert = require('assert');
var env = require('gitter-web-env');
var stats = env.stats;
var Promise = require('bluebird');
var Group = require('gitter-web-persistence').Group;
var Troupe = require('gitter-web-persistence').Troupe;
var liveCollections = require('gitter-web-live-collection-events');
var validateGroupName = require('gitter-web-validators/lib/validate-group-name');
var StatusError = require('statuserror');
var policyFactory = require('gitter-web-permissions/lib/policy-factory');
var debug = require('debug')('gitter:app:groups:group-service');
var mongoUtils = require('gitter-web-persistence-utils/lib/mongo-utils');
var mongooseUtils = require('gitter-web-persistence-utils/lib/mongoose-utils');
var ensureAccessAndFetchDescriptor = require('gitter-web-permissions/lib/ensure-access-and-fetch-descriptor');
var checkIfGroupUriExists = require('./group-uri-checker');
var groupRoomFinder = require('./group-room-finder');
var groupFavouritesCore = require('./group-favourites-core');

/**
 * Find a group given an id
 */
function findById(groupId) {
  return Group.findById(groupId)
    .lean()
    .exec();
}

function findByIds(ids) {
  return mongooseUtils.findByIds(Group, ids);
}

/**
 * Find a group given a URI
 */
function findByUri(uri) {
  assert(uri, 'uri required');
  return Group.findOne({ lcUri: uri.toLowerCase() })
    .lean()
    .exec();
}

/**
 *
 */
function upsertGroup(user, groupInfo, securityDescriptor) {
  var uri = groupInfo.uri;
  var name = groupInfo.name || uri;
  var homeUri;

  if(groupInfo.useHomeUriSuffix) {
    homeUri = uri + '/home';
  } else {
    homeUri = uri;
  }

  var lcUri = uri.toLowerCase();
  var lcHomeUri = homeUri.toLowerCase();

  return mongooseUtils.upsert(Group, { lcUri: lcUri }, {
      $setOnInsert: {
        name: name,
        uri: uri,
        lcUri: lcUri,
        homeUri: homeUri,
        lcHomeUri: lcHomeUri,
        sd: securityDescriptor
      }
    })
    .spread(function(group, updateExisting) {
      if (!updateExisting) {
        /* Send a stat for a new group */
        stats.event('new_group', {
          uri: uri,
          groupId: group._id,
          userId: user._id,
          type: securityDescriptor.type === null ? 'none' : securityDescriptor.type
        });
      }

      return group;
    });
}

function checkGroupUri(user, uri, options) {
  assert(user, 'user required');
  assert(uri, 'uri required');

  // type can be null
  var type = options.type;

  // obtainAccessFromGitHubRepo can be undefined
  var obtainAccessFromGitHubRepo = options.obtainAccessFromGitHubRepo;

  // run the same validation that gets used by the group uri checker service
  return checkIfGroupUriExists(user, uri, obtainAccessFromGitHubRepo)
    .then(function(info) {
      if (!info.allowCreate) {
        // the frontend code should have prevented you from getting here
        /*
        NOTE: 409 because an invalid group uri would already have raised 400,
        so the reason why you can't create the group is either because a group
        or user already took that uri or because another github org or user
        took that uri. This means it also mirrors the check-group-uri endpount.
        */
        throw new StatusError(409, 'User is not allowed to create a group for this URI.');
      }

      if (info.type === 'GH_ORG') {
        if (type !== 'GH_ORG' && type !== 'GH_GUESS') {
          // the frontend code should have prevented you from getting here
          throw new StatusError(400, 'Group must be type GH_ORG: ' + type);
        }
      }
    });
}

/**
 * @private
 */
function ensureAccessAndFetchGroupInfo(user, options) {
  options = options || {};

  var name = options.name;
  assert(name, 'name required');
  if (!validateGroupName(name)) {
    throw new StatusError(400, 'Invalid group name');
  }

  // uri gets validated by checkGroupUri below
  var uri = options.uri;

  // we only support public groups for now
  var security = options.security || 'PUBLIC';
  if (security !== 'PUBLIC') {
    throw new StatusError(400, 'Invalid group security: ' + security);
  }

  return checkGroupUri(user, uri, options)
    .then(function() {
      return ensureAccessAndFetchDescriptor(user, options)
        .then(function(securityDescriptor) {
          return [{
            name: name,
            uri: uri,
            useHomeUriSuffix: options.useHomeUriSuffix
          }, securityDescriptor];
        });
    });
}

/**
 * Create a new group
 */
function createGroup(user, options) {
  return ensureAccessAndFetchGroupInfo(user, options)
    .spread(function(groupInfo, securityDescriptor) {
      debug("Upserting %j with securityDescriptor=%j", groupInfo, securityDescriptor);
      return upsertGroup(user, groupInfo, securityDescriptor);
    });
}



/**
 * @private
 */
function canUserAdminGroup(user, group, obtainAccessFromGitHubRepo) {
  return policyFactory.createPolicyForGroupIdWithRepoFallback(user, group._id, obtainAccessFromGitHubRepo)
    .then(function(policy) {
      return policy.canAdmin();
    });
}

/**
 * During the migration only
 *
 * Ensures that a group exists
 */
function ensureGroupForGitHubRoomCreation(user, options) {
  var uri = options.uri;
  var name = options.name || uri;
  var useHomeUriSuffix = options.useHomeUriSuffix;
  var obtainAccessFromGitHubRepo = options.obtainAccessFromGitHubRepo;

  debug('ensureGroupForGitHubRoomCreation: name=%s uri=%s obtainAccessFromGitHubRepo=%s', name, uri, obtainAccessFromGitHubRepo)
  assert(user, 'user required');
  assert(uri, 'name required');

  return findByUri(uri)
    .then(function(existingGroup) {

      if (existingGroup) {
        debug('Existing group found');
        return canUserAdminGroup(user, existingGroup, obtainAccessFromGitHubRepo)
          .then(function(adminAccess) {
            debug('Has admin access? %s', adminAccess);

            if (!adminAccess) throw new StatusError(403, 'Cannot create a room under ' + uri);
            return existingGroup;
          });
      }

      debug('No existing group. Will create. obtainAccessFromGitHubRepo=%s', obtainAccessFromGitHubRepo);
      return createGroup(user, {
        type: 'GH_GUESS', // how do we know if it is a GH_ORG or GH_USER? or GH_REPO?
        name: name,
        uri: uri,
        useHomeUriSuffix: useHomeUriSuffix,
        linkPath: uri.split('/')[0], // does this make sense? or rather uri?
        obtainAccessFromGitHubRepo: obtainAccessFromGitHubRepo
      });
    });
}

function findRoomsIdForGroup(groupId, userId) {
  assert(groupId, 'groupId is required');

  return groupRoomFinder.queryForAccessibleRooms(groupId, userId)
    .then(function(query) {
      return Troupe.distinct('_id', query)
        .exec();
    });
}

function setAvatarForGroup(groupId, url) {
  var query = { _id: groupId };

  var update = {
    $set: {
      avatarUrl: url
    },
    $inc: {
      avatarVersion: 1
    }
  };

  return Group.findOneAndUpdate(query, update).exec();
}

function setForumForGroup(groupId, forumId) {
  var query = {
    _id: groupId,
    // only do the update if the group doesn't already have a forum
    forumId: { $exists: false }
  };

  var update = {
    $set: {
      forumId: forumId
    }
  };

  return Group.findOneAndUpdate(query, update, { new: true })
    .exec()
    .then(function(group) {
      if (!group || !mongoUtils.objectIDsEqual(group.forumId, forumId)) {
        // NOTE: actually it could just be that the group doesn't exist at
        // all..
        throw new StatusError(409, 'Group already has a forum.');
      }
      return group;
    });
}


function updateFavourite(userId, groupId, favouritePosition) {
  return groupFavouritesCore.updateFavourite(userId, groupId, favouritePosition)
    .then(function(position) {
      liveCollections.userGroups.emit('patch', userId, groupId, { favourite: position });
    });
}




module.exports = {
  findByUri: Promise.method(findByUri),
  findById: Promise.method(findById),
  findByIds: findByIds,
  createGroup: Promise.method(createGroup),
  findRoomsIdForGroup: Promise.method(findRoomsIdForGroup),
  setAvatarForGroup: setAvatarForGroup,
  setForumForGroup: setForumForGroup,
  findFavouriteGroupsForUser: groupFavouritesCore.findFavouriteGroupsForUser,
  updateFavourite: updateFavourite,
  migration: {
    ensureGroupForGitHubRoomCreation: ensureGroupForGitHubRoomCreation,
  }
};
