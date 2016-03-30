"use strict";

var testRequire = require('../../test-require');
var Distribution = testRequire('./services/unread-items/distribution');
var roomMembershipFlags = testRequire('./services/room-membership-flags');
var assert = require('assert');
var MODES = roomMembershipFlags.MODES;

function assertIteratorDeepEqual(iterator, expected) {
  iterator.toArray().forEach(function(array) {
    assert.deepEqual(array, expected);
  });
}

describe('distribution', function() {
  describe('getConnectedActivityUserIds', function() {

    it('should handle users in various connected states', function() {
      var distribution = new Distribution({
        membersWithFlags: [
          { userId: '1', flags: MODES.announcement },
          { userId: '2', flags: MODES.announcement },
          { userId: '3', flags: MODES.announcement },
          { userId: '4', flags: MODES.announcement },
          { userId: '5', flags: MODES.announcement },
          { userId: '6', flags: MODES.announcement },
          { userId: '7', flags: MODES.announcement }
        ],
        presence: {
          '1': 'inroom',
          '2': 'online',
          '3': 'mobile',
          '4': 'push',
          '5': 'push_connected',
          '6': 'push_notified_connected'
        }
      });

      assertIteratorDeepEqual(distribution.getConnectedActivityUserIds(), ['1', '2', '3', '5', '6']);
    });

  });

  describe('getWebNotifications', function() {

    it('should handle users in various connected states', function() {
      var distribution = new Distribution({
        membersWithFlags: [
          { userId: '1', flags: MODES.all },
          { userId: '2', flags: MODES.all },
          { userId: '3', flags: MODES.all },
          { userId: '4', flags: MODES.all },
          { userId: '5', flags: MODES.all },
          { userId: '6', flags: MODES.all },
          { userId: '7', flags: MODES.all }
        ],
        presence: {
          '1': 'inroom',
          '2': 'online',
          '3': 'mobile',
          '4': 'push',
          '5': 'push_connected',
          '6': 'push_notified_connected'
        }
      });

      assertIteratorDeepEqual(distribution.getWebNotifications(), ['2']);
    });

    it('should handle distributions without mentions', function() {
      var distribution = new Distribution({
        membersWithFlags: []
      });

      assertIteratorDeepEqual(distribution.getWebNotifications(), []);
    });

  });

  describe('getNotifyNewRoom', function() {

    it('should handle values', function() {
      var distribution = new Distribution({
        membersWithFlags: [
          { userId: '1' },
          { userId: '2' },
        ],
        nonMemberMentions: ['1', '2']
      });

      assertIteratorDeepEqual(distribution.getNotifyNewRoom(), ['1', '2']);
    });

  });

  describe('getPushCandidatesWithoutMention', function() {

    it('should handle users in various connected states', function() {
      var distribution = new Distribution({
        membersWithFlags: [
          { userId: '1', flags: MODES.all },
          { userId: '2', flags: MODES.all },
          { userId: '3', flags: MODES.all },
          { userId: '4', flags: MODES.all },
          { userId: '5', flags: MODES.all },
          { userId: '6', flags: MODES.all },
          { userId: '7', flags: MODES.all },
          { userId: '8', flags: MODES.all },
        ],
        presence: {
          '1': 'inroom',
          '2': 'online',
          '3': 'mobile',
          '4': 'push',
          '5': 'push_connected',
          '6': 'push_notified_connected',
          '7': 'push_notified',
        }
      });

      assertIteratorDeepEqual(distribution.getPushCandidatesWithoutMention(), ['4', '5']);
    });

    it('should handle distributions without mentions', function() {
      var distribution = new Distribution({
        membersWithFlags: []
      });

      assertIteratorDeepEqual(distribution.getPushCandidatesWithoutMention(), []);
    });

  });

  describe('getPushCandidatesWithMention', function() {

    it('should handle users in various connected states', function() {
      var distribution = new Distribution({
        membersWithFlags: [
          { userId: '1', flags: MODES.all },
          { userId: '2', flags: MODES.all },
          { userId: '3', flags: MODES.all },
          { userId: '4', flags: MODES.all },
          { userId: '5', flags: MODES.all },
          { userId: '6', flags: MODES.all },
          { userId: '7', flags: MODES.all },
          { userId: '8', flags: MODES.all },
        ],
        mentions: ['1', '2', '3', '4', '5', '6', '7', '8'],
        presence: {
          '1': 'inroom',
          '2': 'online',
          '3': 'mobile',
          '4': 'push',
          '5': 'push_connected',
          '6': 'push_notified_connected',
          '8': 'push_notified',
        }
      });

      assertIteratorDeepEqual(distribution.getPushCandidatesWithMention(), ['4', '5', '6', '8']);
    });

    it('should handle users in various modes for announcements', function() {
      var distribution = new Distribution({
        membersWithFlags: [
          { userId: '1', flags: MODES.all },
          { userId: '2', flags: MODES.announcement },
          { userId: '3', flags: MODES.mute },
        ],
        announcement: true,
        presence: {
          '1': 'push_notified',
          '2': 'push_notified',
          '3': 'push_notified',
        }
      });

      assertIteratorDeepEqual(distribution.getPushCandidatesWithMention(), ['1','2']);
    });

    it('should handle distributions without mentions', function() {
      var distribution = new Distribution({
        membersWithFlags: []
      });

      assertIteratorDeepEqual(distribution.getPushCandidatesWithMention(), []);
    });

  });

  describe('getTroupeUnreadCountsChange', function() {

    it('should handle users in various connected states', function() {
      var distribution = new Distribution({
        membersWithFlags: [
          { userId: '1', flags: MODES.all },
          { userId: '2', flags: MODES.all },
          { userId: '3', flags: MODES.all },
          { userId: '4', flags: MODES.all },
          { userId: '5', flags: MODES.all },
          { userId: '6', flags: MODES.all },
          { userId: '7', flags: MODES.all }
        ],
        presence: {
          '1': 'inroom',
          '2': 'online',
          '3': 'mobile',
          '4': 'push',
          '5': 'push_connected',
          '6': 'push_notified_connected'
        }
      });

      var results = distribution.resultsProcessor({
        '1': { unreadCount: 1, mentionCount: 1 },
        '2': { unreadCount: 2, mentionCount: 2 },
        '3': { unreadCount: 3, mentionCount: 3 },
        '4': { unreadCount: 4, mentionCount: 4 },
        '5': { unreadCount: 5, mentionCount: 5 },
        '6': { unreadCount: 6, mentionCount: 6 },
        '7': { unreadCount: 7, mentionCount: 7 },
      });

      assertIteratorDeepEqual(results.getTroupeUnreadCountsChange(), [
        { userId: '1', total: 1, mentions: 1 },
        { userId: '2', total: 2, mentions: 2 },
        { userId: '3', total: 3, mentions: 3 },
        { userId: '5', total: 5, mentions: 5 },
        { userId: '6', total: 6, mentions: 6 }
      ]);
    });

    it('should handle different values for counts', function() {
      var distribution = new Distribution({
        membersWithFlags: [
          { userId: '1', flags: MODES.all },
          { userId: '2', flags: MODES.all },
          { userId: '3', flags: MODES.all },
          { userId: '4', flags: MODES.all },
          { userId: '5', flags: MODES.all },
        ],
        presence: {
          '1': 'inroom',
          '2': 'inroom',
          '3': 'inroom',
          '4': 'inroom',
          '5': 'inroom',
        }
      });

      var results = distribution.resultsProcessor({
        '1': { unreadCount: 0, mentionCount: 0 },
        '2': { unreadCount: 2, mentionCount: 0 },
        '3': { unreadCount: 0, mentionCount: 3 },
        '4': { unreadCount: 4, mentionCount: 4 },
        '5': {  },
      });

      assertIteratorDeepEqual(results.getTroupeUnreadCountsChange(), [
        { userId: '1', total: 0, mentions: 0 },
        { userId: '2', total: 2, mentions: 0 },
        { userId: '3', total: 0, mentions: 3 },
        { userId: '4', total: 4, mentions: 4 }
      ]);
    });
  });

  describe('getBadgeUpdates', function() {
    it('should handle users in various connected states', function() {
      var distribution = new Distribution({
        membersWithFlags: [
          { userId: '1', flags: MODES.all },
          { userId: '2', flags: MODES.all },
          { userId: '3', flags: MODES.all },
          { userId: '4', flags: MODES.all },
          { userId: '5', flags: MODES.all },
          { userId: '6', flags: MODES.all },
          { userId: '7', flags: MODES.all }
        ],
        presence: {
          '1': 'inroom',
          '2': 'online',
          '3': 'mobile',
          '4': 'push',
          '5': 'push_connected',
          '6': 'push_notified_connected'
        }
      });

      var results = distribution.resultsProcessor({
        '1': { badgeUpdate: true },
        '2': { badgeUpdate: true },
        '3': { badgeUpdate: true },
        '4': { badgeUpdate: true },
        '5': { badgeUpdate: true },
        '6': { badgeUpdate: true },
        '7': { badgeUpdate: true },
      });

      assertIteratorDeepEqual(results.getBadgeUpdates(), ['1','2','3','4','5','6']);
    });

    it('should handle different values for counts', function() {
      var distribution = new Distribution({
        membersWithFlags: [
          { userId: '1', flags: MODES.all },
          { userId: '2', flags: MODES.all },
          { userId: '3', flags: MODES.all },
          { userId: '4', flags: MODES.all },
        ],
        presence: {
          '1': 'inroom',
          '2': 'inroom',
          '3': 'inroom',
          '4': 'inroom',
        }
      });

      var results = distribution.resultsProcessor({
        '1': { badgeUpdate: true },
        '2': { badgeUpdate: false },
        '3': {  },
      });

      assertIteratorDeepEqual(results.getBadgeUpdates(), ['1']);
    });
  });

  describe('getNewUnreadWithMention', function() {
    it('should handle users in various connected states', function() {
      var distribution = new Distribution({
        membersWithFlags: [
          { userId: '1', flags: MODES.all },
          { userId: '2', flags: MODES.all },
          { userId: '3', flags: MODES.all },
          { userId: '4', flags: MODES.all },
          { userId: '5', flags: MODES.all },
          { userId: '6', flags: MODES.all },
          { userId: '7', flags: MODES.all }
        ],
        mentions: ['1', '2', '3', '4', '5', '6', '7'],
        presence: {
          '1': 'inroom',
          '2': 'online',
          '3': 'mobile',
          '4': 'push',
          '5': 'push_connected',
          '6': 'push_notified_connected'
        }
      });

      var results = distribution.resultsProcessor({
      });

      assertIteratorDeepEqual(results.getNewUnreadWithMention(), ['1','2','3','5','6']);
    });

    it('should treat announcements as mentions', function() {
      var distribution = new Distribution({
        membersWithFlags: [
          { userId: '1', flags: MODES.announcement },
          { userId: '2', flags: MODES.announcement },
          { userId: '3', flags: MODES.announcement },
          { userId: '4', flags: MODES.mute },
        ],
        announcement: true,
        presence: {
          '1': 'online',
          '2': 'online',
          '4': 'online',
        }
      });

      var results = distribution.resultsProcessor({
      });

      assertIteratorDeepEqual(results.getNewUnreadWithMention(), ['1', '2']);
    });
  });


  describe('getNewUnreadWithoutMention', function() {
    it('should handle users in various connected states', function() {
      var distribution = new Distribution({
        membersWithFlags: [
          { userId: '1', flags: MODES.all },
          { userId: '2', flags: MODES.all },
          { userId: '3', flags: MODES.all },
          { userId: '4', flags: MODES.all },
          { userId: '5', flags: MODES.all },
          { userId: '6', flags: MODES.all },
          { userId: '7', flags: MODES.all }
        ],
        presence: {
          '1': 'inroom',
          '2': 'online',
          '3': 'mobile',
          '4': 'push',
          '5': 'push_connected',
          '6': 'push_notified_connected'
        }
      });

      var results = distribution.resultsProcessor({
      });

      assertIteratorDeepEqual(results.getNewUnreadWithoutMention(), ['1','2','3','5','6']);
    });

    it('should treat announcements as mentions', function() {
      var distribution = new Distribution({
        membersWithFlags: [
          { userId: '1', flags: MODES.all },
          { userId: '2', flags: MODES.announcement },
          { userId: '3', flags: MODES.mute }
        ],
        announcement: true,
        presence: {
          '1': 'online',
          '2': 'online',
          '3': 'online',
          '4': 'online',
          '5': 'online',
          '6': 'online'
        }
      });

      var results = distribution.resultsProcessor({
      });

      assertIteratorDeepEqual(results.getNewUnreadWithoutMention(), []);
    });

  });

});
