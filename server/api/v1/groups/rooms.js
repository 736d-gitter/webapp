'use strict';

var assert = require('assert');
var StatusError = require('statuserror');
var restful = require('../../../services/restful')
var GroupWithPolicyService = require('../../../services/group-with-policy-service');
var restSerializer = require('../../../serializers/rest-serializer');

function getCreateOptions(input) {
  var name = input.name ? String(input.name) : undefined;
  var topic = input.topic ? String(input.topic) : undefined;
  var createOptions = { name: name, topic: topic };
  var linkPath;

  if (input.security) {
    linkPath = input.security.linkPath ? String(input.security.linkPath) : undefined;

    // PUBLIC or PRIVATE
    createOptions.security = input.security.security ? String(input.security.security) : undefined;
    assert(createOptions.security, 'security required');

    // type defaults to null, not undefined
    createOptions.type = input.security.type ? String(input.security.type) : null;
    if (createOptions.type) {
      // for GitHub and future room types that are backed by other services
      createOptions.linkPath = linkPath;
      assert(createOptions.linkPath, 'linkPath required');
    }
  } else {
    createOptions.security = 'PUBLIC';
  }

  // input is json, so input.providers should already be an array if it
  // exists. it gets validated further inside GroupWithPolicyService.
  if (input.providers && Array.isArray(input.providers)) {
    createOptions.providers = input.providers;
  }

  // If the backing type of the room is a repo,
  // attempt to associate the room with that repo.
  // In future, we could do this for any type of room
  if (createOptions.type === 'GH_REPO') {
    createOptions.associateWithGitHubRepo = linkPath;
  }

  createOptions.addBadge = !!input.addBadge

  // keep tracking info around for sendStats
  if (typeof input.source === 'string') {
    createOptions.tracking = { source: input.source };
  }

  return createOptions;
}

module.exports = {
  id: 'groupRoom',

  index: function(req) {
    var groupId = req.group._id;
    var user = req.user;
    var userId = user && user._id;

    return restful.serializeRoomsForGroupId(groupId, userId);
  },

  create: function(req) {
    if (!req.user) {
      throw new StatusError(401);
    }

    var createOptions = getCreateOptions(req.body);

    var groupWithPolicyService = new GroupWithPolicyService(req.group, req.user, req.userGroupPolicy);
    return groupWithPolicyService.createRoom(createOptions)
      .then(function(createResult) {
        var room = createResult.troupe;
        var hookCreationFailedDueToMissingScope = createResult.hookCreationFailedDueToMissingScope;
        var strategy = new restSerializer.TroupeStrategy({
          currentUserId: req.user.id,
          currentUser: req.user,
          includeRolesForTroupe: room,
          // include all these because it will replace the troupe in the context
          includeTags: true,
          includeProviders: true,
          includeGroups: true
        });

        return restSerializer.serializeObject(room, strategy)
          .then(function(serialized) {
            serialized.extra = {
              hookCreationFailedDueToMissingScope: hookCreationFailedDueToMissingScope
            };
            return serialized;

          })
      });
  }
};
