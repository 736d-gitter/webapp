'use strict';

var Backbone = require('backbone');
var roomAvailabilityStatusConstants = require('../views/create-room/room-availability-status-constants');

var CreateRoomViewModel = Backbone.Model.extend({
  defaults: {
    initialGroupId: null,
    groupId: null,
    roomName: '',
    associatedGithubProject: null,
    allowBadger: true,
    security: 'PUBLIC',
    onlyGithubUsers: false,
    onlyGroupUsers: false,

    // roomAvailabilityStatusConstants
    roomAvailabilityStatus: null
  },

  validate: function() {
    var errors = [];

    var roomName = this.get('roomName') || '';

    var hasRoomName = roomName.length > 0;
    if (!hasRoomName) {
      errors.push({
        key: 'roomName',
        message: 'Please fill in the room name'
      });
    } else if (this.get('roomAvailabilityStatus') === roomAvailabilityStatusConstants.UNAVAILABLE) {
      errors.push({
        key: 'roomName',
        message: 'There is already a room with that name.'
      });
    } else if (
      this.get('roomAvailabilityStatus') === roomAvailabilityStatusConstants.VALIDATION_FAILED
    ) {
      errors.push({
        key: 'roomName',
        message: 'Validation failed'
      });
    } else if (
      this.get('roomAvailabilityStatus') === roomAvailabilityStatusConstants.ILLEGAL_NAME
    ) {
      errors.push({
        key: 'roomName',
        message: 'Room names can only contain letters, numbers, and dashes'
      });
    } else if (
      this.get('roomAvailabilityStatus') === roomAvailabilityStatusConstants.REPO_CONFLICT
    ) {
      errors.push({
        key: 'roomName',
        message:
          'You cannot create a room with a same name that as an already existing repo. You may need to grant public/private repo scope on the GitHub org in order for us to see and auto-associate it (the repo should appear in the room name typeahead).'
      });
    } else if (this.get('roomAvailabilityStatus') === roomAvailabilityStatusConstants.PENDING) {
      errors.push({
        key: 'roomName',
        message: 'Waiting for room name check to respond'
      });
    } else if (
      this.get('roomAvailabilityStatus') ===
      roomAvailabilityStatusConstants.INSUFFICIENT_PERMISSIONS
    ) {
      errors.push({
        key: 'roomName',
        message: "You don't have sufficient permissions to create this room. Are you an admin?"
      });
    } else if (
      this.get('roomAvailabilityStatus') === roomAvailabilityStatusConstants.GROUP_REQUIRED
    ) {
      errors.push({
        key: 'group',
        message: 'Please select a community'
      });
    }

    return errors.length > 0 ? errors : undefined;
  }
});

module.exports = CreateRoomViewModel;
