/* jshint node:true, unused:true */
'use strict';

var makeBenchmark = require('../make-benchmark');
var testRequire = require('../integration/test-require');
var mockito = require('jsmockito').JsMockito;

var Q = require('q');
var mongoUtils = testRequire('./utils/mongo-utils');

var TOTAL_USERS = 10000;

var chatId;
var troupeId;
var fromUserId;
var userIds;
var roomMembershipService;
var appEvents;
var userService;
var roomPermissionsModel;
var chatWithNoMentions;
var unreadItemService;
var troupe;
var troupeLurkersUserHash;

makeBenchmark({
  before: function() {
    troupeId = mongoUtils.getNewObjectIdString() + "";
    chatId = mongoUtils.getNewObjectIdString() + "";
    fromUserId = mongoUtils.getNewObjectIdString() + "";
    userIds = [];
    troupeLurkersUserHash = {};
    for (var i = 0; i < TOTAL_USERS; i++) {
      var id = mongoUtils.getNewObjectIdString() + "";
      userIds.push(id);
      troupeLurkersUserHash[id] = false; // Not lurking
    }

    chatWithNoMentions = {
      id: chatId,
      mentions: []
    };

    troupe = {
      id: troupeId,
      _id: troupeId,
    };

    roomMembershipService = mockito.mock(testRequire('./services/room-membership-service'));
    userService = mockito.mock(testRequire('./services/user-service'));
    appEvents = mockito.mock(testRequire('gitter-web-appevents'));
    roomPermissionsModel = mockito.mockFunction();

    mockito.when(roomMembershipService).findMembersForRoomWithLurk(troupeId).thenReturn(Q.resolve(troupeLurkersUserHash));

    unreadItemService = testRequire.withProxies("./services/unread-item-service", {
      './room-membership-service': roomMembershipService,
      './user-service': userService,
      '../app-events': appEvents,
      './room-permissions-model': roomPermissionsModel,
    });
    unreadItemService.testOnly.setSendBadgeUpdates(false);

  },

  tests: {
    'createChatUnreadItems#largeRoom': function(done) {
      unreadItemService.createChatUnreadItems(fromUserId, troupe, chatWithNoMentions)
        .nodeify(done);
    }

  }

});
