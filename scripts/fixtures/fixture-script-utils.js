'use strict';

var Promise = require('bluebird');
// Prevent "Error: cannot enable cancellation after promises are in use" in
// scripts that use RealtimeClient.
Promise.config({
  cancellation: true
});
var StatusError = require('statuserror');
var shutdown = require('shutdown');
var userService = require('../../server/services/user-service');
var groupService = require('gitter-web-groups/lib/group-service');
var forumService = require('gitter-web-topics/lib/forum-service');
var policyFactory = require('gitter-web-permissions/lib/policy-factory');
var GroupWithPolicyService = require('../../server/services/group-with-policy-service');
var ForumWithPolicyService = require('../../server/services/forum-with-policy-service');


function getGroupWithPolicyService(username, groupUri) {
  return Promise.join(
      userService.findByUsername(username),
      groupService.findByUri(groupUri))
    .bind({})
    .spread(function(user, group) {
      if (!user) throw new StatusError(404, 'User not found.');
      if (!group) throw new StatusError(404, 'Group not found.');

      this.user = user;
      this.group = group;

      return policyFactory.createPolicyForGroupId(user, group._id);
    })
    .then(function(policy) {
      return new GroupWithPolicyService(this.group, this.user, policy);
    });
}

function getForumWithPolicyService(username, groupUri) {
  return Promise.join(
      userService.findByUsername(username),
      groupService.findByUri(groupUri))
    .bind({})
    .spread(function(user, group) {
      if (!user) throw new StatusError(404, 'User not found.');
      if (!group) throw new StatusError(404, 'Group not found.');

      if (!group.forumId) throw new StatusError(404, "The group doesn't have a forum yet");

      this.user = user;
      this.group = group;

      return forumService.findById(group.forumId);

    })
    .then(function(forum) {
      if (!forum) throw new StatusError(404, 'Forum not found.');

      this.forum = forum;

      return policyFactory.createPolicyForForum(this.user, forum);
    })
    .then(function(policy) {
      return new ForumWithPolicyService(this.forum, this.user, policy);
    });
}

function getUser(username) {
  return userService.findByUsername(username);
}

function getForum(uri) {
  return groupService.findByUri(uri)
    .then(function(group) {
      if (!group) throw new StatusError(404, 'Group not found.');
      if (!group.forumId) throw new StatusError(404, 'The group has no forum.');
      return forumService.findById(group.forumId);
    });
}

function runScript(run) {
  require('../../server/event-listeners').install();

  run()
    // Without this delay, the bayeux event probably won't go out to the
    // subscribers. It will make you sad :(
    .delay(5000)
    .then(function() {
      shutdown.shutdownGracefully();
    })
    .catch(function(err) {
      console.error(err);
      console.error(err.stack);
      process.exit(1);
      shutdown.shutdownGracefully(1);
    });
}

module.exports = {
  getGroupWithPolicyService: getGroupWithPolicyService,
  getForumWithPolicyService: getForumWithPolicyService,
  getUser: getUser,
  getForum: getForum,
  runScript: runScript
};
