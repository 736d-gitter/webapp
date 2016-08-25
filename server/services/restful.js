"use strict";

var env = require('gitter-web-env');
var logger = env.logger;

var Promise = require('bluebird');
var StatusError = require('statuserror');
var _ = require('underscore');
var gitHubProfileService = require('gitter-web-github-backend/lib/github-profile-service');
var groupService = require('gitter-web-groups/lib/group-service');
var groupMembershipService = require('gitter-web-groups/lib/group-membership-service');
var restSerializer = require("../serializers/rest-serializer");
var unreadItemService = require("./unread-items");
var chatService = require("./chat-service");
var userService = require("./user-service");
var userTypeahead = require('./typeaheads/user-typeahead');
var eventService = require("./event-service");
var roomService = require('./room-service');
var roomMembershipService = require('./room-membership-service');
var orgService = require("./org-service");
var repoService = require("./repo-service");
var userScopes = require('gitter-web-identity/lib/user-scopes');
var topicService = require('gitter-web-topics/lib/topic-service');

var survivalMode = !!process.env.SURVIVAL_MODE || false;

if (survivalMode) {
  logger.error("WARNING: Running in survival mode");
}

var DEFAULT_CHAT_COUNT_LIMIT = 30;
var DEFAULT_USERS_LIMIT = 30;
var MAX_USERS_LIMIT = 100;

function serializeTroupesForUser(userId, callback) {
  if(!userId) return Promise.resolve([]);

  return roomService.findAllRoomsIdsForUserIncludingMentions(userId)
    .spread(function(allTroupeIds, nonMemberTroupeIds) {
      var strategy = new restSerializer.TroupeIdStrategy({
        currentUserId: userId,
        // This will save the troupeId strategy
        // from having to do a second query
        nonMemberTroupeIds: nonMemberTroupeIds,
        includeTags: true
      });

      return restSerializer.serialize(allTroupeIds, strategy);
    })
    .nodeify(callback);
}

function serializeChatsForTroupe(troupeId, userId, options, callback) {
  options = _.extend({}, {
    skip: 0,
    limit: DEFAULT_CHAT_COUNT_LIMIT,
    userId: userId // This may also be appearing through in options
  }, options);

  var initialId = options.aroundId;

  return chatService.findChatMessagesForTroupe(troupeId, options)
    .then(function(chatMessages) {
      var strategy = new restSerializer.ChatStrategy({
        notLoggedIn: !userId,
        initialId: initialId,
        currentUserId: userId,
        troupeId: troupeId,
        unread: options.unread,
        lean: options.lean,
        lookups: options.lookups
      });

      return restSerializer.serialize(chatMessages, strategy);
    })
    .nodeify(callback);
}

function serializeUsersForTroupe(troupeId, userId, options) {
  if (!options) options = {};

  var skip = options.skip;
  if (!skip || isNaN(skip)) {
    skip = 0;
  }

  var limit = options.limit;
  var searchTerm = options.searchTerm;

  if (!limit || isNaN(limit)) {
    limit = DEFAULT_USERS_LIMIT;
  } else if (limit > MAX_USERS_LIMIT) {
    limit = MAX_USERS_LIMIT;
  }

  if(typeof searchTerm === 'string') {
    if (survivalMode || searchTerm.length < 1) {
      return Promise.resolve([]);
    }

    return userTypeahead.query(searchTerm, { roomId: troupeId })
      .then(function(users) {
        var strategy = new restSerializer.UserStrategy();
        return restSerializer.serialize(users, strategy);
      });

  }

  return roomMembershipService.findMembersForRoom(troupeId, { limit: limit, skip: skip })
    .then(function(userIds) {
      var strategy = new restSerializer.UserIdStrategy({
        showPresenceForTroupeId: troupeId,
        includeRolesForTroupeId: troupeId,
        currentUserId: userId,
        lean: !!options.lean
      });

      return restSerializer.serialize(userIds, strategy);
    });
}

function serializeUnreadItemsForTroupe(troupeId, userId, callback) {
  return Promise.all([
      roomMembershipService.getMemberLurkStatus(troupeId, userId),
      unreadItemService.getUnreadItemsForUser(userId, troupeId)
    ])
    .spread(function(isLurking, items) {
      if(isLurking) {
        items._meta = { lurk: true };
      }
      return items;
    })
    .nodeify(callback);
}

function serializeReadBysForChat(troupeId, chatId, callback) {
  // TODO: assert that troupeId=chat.troupeId....
  return chatService.findById(chatId)
    .then(function(chatMessage) {
      var strategy = new restSerializer.UserIdStrategy({});

      return restSerializer.serialize(chatMessage.readBy, strategy);
    })
    .nodeify(callback);
}

function serializeEventsForTroupe(troupeId, userId, callback) {
  return eventService.findEventsForTroupe(troupeId, {})
    .then(function(events) {
      var strategy = new restSerializer.EventStrategy({ currentUserId: userId, troupeId: troupeId });
      return restSerializer.serialize(events, strategy);
    })
    .nodeify(callback);
}

function serializeOrgsForUser(user) {
  return orgService.getOrgsForUser(user)
    .then(function(orgs) {
      var strategyOptions = { currentUserId: user.id };
      // TODO: not all organisations are going to be github ones in future!
      var strategy = new restSerializer.GithubOrgStrategy(strategyOptions);
      return restSerializer.serialize(orgs, strategy);
    });
}

function serializeOrgsForUserId(userId, options) {
  return userService.findById(userId)
    .then(function(user) {
      if(!user) return [];

      return serializeOrgsForUser(user, options);
    });
}

function serializeUnusedOrgsForUser(user) {
  return orgService.getUnusedOrgsForUser(user)
    .then(function(orgs) {
      var strategyOptions = { currentUserId: user.id };
      var strategy = new restSerializer.GithubOrgStrategy(strategyOptions);
      return restSerializer.serialize(orgs, strategy);
    });

}

function serializeReposForUser(user) {
  return repoService.getReposForUser(user)
    .then(function(repos) {
      var strategyOptions = { currentUserId: user.id };
      var strategy = new restSerializer.GithubRepoStrategy(strategyOptions);
      return restSerializer.serialize(repos, strategy);
    });
}

function serializeUnusedReposForUser(user) {
  return repoService.getUnusedReposForUser(user)
    .then(function(repos) {
      var strategyOptions = { currentUserId: user.id };
      var strategy = new restSerializer.GithubRepoStrategy(strategyOptions);
      return restSerializer.serialize(repos, strategy);
    });
}

function serializeProfileForUsername(username) {
  return userService.findByUsername(username)
    .then(function(user) {
      if (user) {
        var strategy = new restSerializer.UserProfileStrategy();
        return restSerializer.serializeObject(user, strategy);

      } else {
        var gitHubUser = {username: username};

        if (!userScopes.isGitHubUser(gitHubUser)) {
          throw new StatusError(404);
        }

        return gitHubProfileService(gitHubUser, {includeCore: true});
      }
    });
}


function serializeGroupsForUserId(userId, options) {
  if (!userId) return [];

  return groupMembershipService.findGroupsForUser(userId)
    .then(function(groups) {
      if (!groups || !groups.length) return [];

      var strategy = new restSerializer.GroupStrategy({
        currentUserId: userId,
        lean: options && options.lean
      });

      return restSerializer.serialize(groups, strategy);
    });
}

function serializeAdminGroupsForUser(user, options) {
  if (!user) return [];

  return groupMembershipService.findAdminGroupsForUser(user)
    .then(function(groups) {
      if (!groups || !groups.length) return [];

      var strategy = new restSerializer.GroupStrategy({
        currentUserId: user._id,
        currentUser: user,
        lean: options && options.lean
      });

      return restSerializer.serialize(groups, strategy);
    });
}

function serializeRoomsForGroupId(groupId, userId) {
  return groupService.findRoomsIdForGroup(groupId, userId)
    .then(function(allTroupeIds) {
      var strategy = new restSerializer.TroupeIdStrategy({
        currentUserId: userId
      });

      return restSerializer.serialize(allTroupeIds, strategy);
    });
}

function serializeTopicsForForumId(forumId) {
  // TODO: return a sample set, not all of them
  return topicService.findByForumId(forumId)
    .then(function(topics) {
      var strategy = new restSerializer.TopicStrategy({
        // again: _some_ replies, not all of them
        includeReplies: true,
        includeRepliesTotals: true,
      });
      return restSerializer.serialize(topics, strategy);
    });
}

module.exports = {
  serializeTroupesForUser: serializeTroupesForUser,
  serializeChatsForTroupe: serializeChatsForTroupe,
  serializeUsersForTroupe: serializeUsersForTroupe,
  serializeUnreadItemsForTroupe: serializeUnreadItemsForTroupe,
  serializeReadBysForChat: serializeReadBysForChat,
  serializeEventsForTroupe: serializeEventsForTroupe,
  serializeOrgsForUser: serializeOrgsForUser,
  serializeOrgsForUserId: serializeOrgsForUserId,
  serializeUnusedOrgsForUser: serializeUnusedOrgsForUser,
  serializeReposForUser: serializeReposForUser,
  serializeUnusedReposForUser: serializeUnusedReposForUser,
  serializeProfileForUsername: serializeProfileForUsername,
  serializeGroupsForUserId: Promise.method(serializeGroupsForUserId),
  serializeAdminGroupsForUser: Promise.method(serializeAdminGroupsForUser),
  serializeRoomsForGroupId: serializeRoomsForGroupId,
  serializeTopicsForForumId: serializeTopicsForForumId
}
