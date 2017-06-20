/* jshint node:true, unused:true */
'use strict';

var makeBenchmark = require('../make-benchmark');
var testRequire = require('../integration/test-require');
var _ = require('lodash');
var Q = require('bluebird-q');

var mongoUtils = testRequire('./utils/mongo-utils');
var unreadItemsServiceEngine = testRequire('./services/unread-item-service-engine');

var largeUserSet = [];
var largeUserSetSingleMention = [];
var largeUserSetManyMentions = [];
var smallUserSet = [];
var smallUserSetSingleMention = [];
var smallUserSetManyMentions = [];

for (var i = 0; i < 10000; i++) {
  var id = mongoUtils.getNewObjectIdString() + "";
  largeUserSet.push(id);

  if (i % 2 === 0) {
    largeUserSetManyMentions.push(id);
  }

  if (i === 0) {
    largeUserSetSingleMention.push(id);
    smallUserSetSingleMention.push(id);
  }

  if (i < 100) {
    smallUserSet.push(id);
    if (i % 2 === 0) {
      smallUserSetManyMentions.push(id);
    }
  }
}

var troupeId = mongoUtils.getNewObjectIdString();
var userIdWithSet = mongoUtils.getNewObjectIdString();
var userIdWithSortedSet = mongoUtils.getNewObjectIdString();

makeBenchmark({
  before: function(done) {
    unreadItemsServiceEngine.newItemWithMentions(troupeId, mongoUtils.getNewObjectIdString(), [userIdWithSet], [])
      .then(function() {
        return Q.all(_.range(120).map(function() {
          unreadItemsServiceEngine.newItemWithMentions(troupeId, mongoUtils.getNewObjectIdString(), [userIdWithSortedSet], []);
        }));
      })
      .nodeify(done);
  },
  tests: {
    'count with set': function(done) {
      unreadItemsServiceEngine.getUserUnreadCountsForRooms(userIdWithSet, [troupeId])
        .nodeify(done);
    },

    'count with sorted set': function(done) {
      unreadItemsServiceEngine.getUserUnreadCountsForRooms(userIdWithSortedSet, [troupeId])
        .nodeify(done);
    },

  }

});
