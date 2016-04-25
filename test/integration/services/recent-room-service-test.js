/*jslint node:true, unused:true*/
/*global describe:true, it:true, before:true, after: true */
"use strict";

var testRequire = require('../test-require');
var assert = require('assert');
var fixtureLoader = require('../test-fixtures');

var recentRoomService = testRequire("./services/recent-room-service");
var recentRoomCore = testRequire("./services/core/recent-room-core");
var persistenceService = require('gitter-web-persistence');

describe('recent-room-service', function() {
  describe('ordering', function() {
    var fixture = {};

    before(fixtureLoader(fixture, {
      user1: { permissions: { createRoom: true } },
      userNoTroupes: { },
      troupe1: { users: ['user1'] },
      troupe2: { users: ['user1'] },
      troupe3: { users: ['user1'] },
      troupe4: { users: ['user1'] }
    }));

    after(function() {
      fixture.cleanup();
    });

    it('should rearrange the order of favourites correctly',function(done) {
      this.timeout(10000);

      function getFavs() {
        return recentRoomCore.findFavouriteTroupesForUser(fixture.user1.id);
      }

      recentRoomService.updateFavourite(fixture.user1.id, fixture.troupe1.id, 1)
        .then(getFavs)
        .then(function(favs) {
          assert.equal(favs[fixture.troupe1.id], 1);
        })
        .then(function() {
          return recentRoomService.updateFavourite(fixture.user1.id, fixture.troupe2.id, 1);
        })
        .then(getFavs)
        .then(function(favs) {
          assert.equal(favs[fixture.troupe1.id], 2);
          assert.equal(favs[fixture.troupe2.id], 1);
        })
        .then(function() {
          return recentRoomService.updateFavourite(fixture.user1.id, fixture.troupe2.id, 3);
        })
        .then(getFavs)
        .then(function(favs) {
          assert.equal(favs[fixture.troupe1.id], 2);
          assert.equal(favs[fixture.troupe2.id], 3);
        })
        .then(function() {
          return recentRoomService.updateFavourite(fixture.user1.id, fixture.troupe3.id, 1);
        })
        .then(getFavs)
        .then(function(favs) {
          assert.equal(favs[fixture.troupe3.id], 1);
          assert.equal(favs[fixture.troupe1.id], 2);
          assert.equal(favs[fixture.troupe2.id], 3);
        })
        .then(function() {
          return recentRoomService.updateFavourite(fixture.user1.id, fixture.troupe2.id, 2);
        })
        .then(getFavs)
        .then(function(favs) {
          assert.equal(favs[fixture.troupe3.id], 1);
          assert.equal(favs[fixture.troupe2.id], 2);
          assert.equal(favs[fixture.troupe1.id], 3);
        })
        .then(function() {
          return recentRoomService.updateFavourite(fixture.user1.id, fixture.troupe1.id, 4);
        })
        .then(getFavs)
        .then(function(favs) {
          assert.equal(favs[fixture.troupe3.id], 1);
          assert.equal(favs[fixture.troupe2.id], 2);
          assert.equal(favs[fixture.troupe1.id], 4);
        })
        .then(function() {
          return recentRoomService.updateFavourite(fixture.user1.id, fixture.troupe4.id, 1);
        })
        .then(getFavs)
        .then(function(favs) {
          assert.equal(favs[fixture.troupe4.id], 1);
          assert.equal(favs[fixture.troupe3.id], 2);
          assert.equal(favs[fixture.troupe2.id], 3);
          assert.equal(favs[fixture.troupe1.id], 4);
        })

        .nodeify(done);
    });

  });

  describe('#updateFavourite()', function() {
    var fixture = {};

    before(fixtureLoader(fixture, {
      user1: { permissions: { createRoom: true } },
      troupe1: { users: ['user1'] }
    }));

    after(function() {
      fixture.cleanup();
    });

    it('should add a troupe to favourites',function(done) {

      function fav(val, callback) {
        return recentRoomService.updateFavourite(fixture.user1.id, fixture.troupe1.id, val)
          .then(function() {
            return recentRoomService.findFavouriteTroupesForUser(fixture.user1.id);
          })
          .then(function(favs) {
            var isInTroupe = !!favs[fixture.troupe1.id];
            assert(isInTroupe === val, 'Troupe should ' + (val? '': 'not ') + 'be a favourite');
          })
          .nodeify(callback);
      }

      fav(true, function() {
        fav(true, function() {
          fav(false, function() {
            fav(false, function() {
              done();
            });
          });
        });
      });

    });

  });

  describe("#saveLastVisitedTroupeforUserId", function() {
    var fixture = {};

    before(fixtureLoader(fixture, {
      user1: { permissions: { createRoom: true } },
      troupe1: { users: ['user1'] }
    }));

    after(function() {
      fixture.cleanup();
    });

    it('should record the time each troupe was last accessed by a user', function(done) {
      return recentRoomService.saveLastVisitedTroupeforUserId(fixture.user1.id, fixture.troupe1.id)
        .then(function() {
          return persistenceService.User.findById(fixture.user1.id).exec();
        })
        .then(function(user) {
          assert.equal(user.lastTroupe, fixture.troupe1.id);

          return recentRoomCore.getTroupeLastAccessTimesForUser(fixture.user1.id);
        })
        .then(function(times) {
          var troupeId = "" + fixture.troupe1.id;

          var after = times[troupeId];
          assert(after, 'Expected a value for last access time');

          return recentRoomService.saveLastVisitedTroupeforUserId(fixture.user1.id, fixture.troupe1.id)
            .then(function() {
              return recentRoomCore.getTroupeLastAccessTimesForUser(fixture.user1.id);
            })
            .then(function(times) {
              assert(times[troupeId] > after, 'The last access time for this troupe has not changed. Before it was ' + after + ' now it is ' + times[troupeId]);
            });
      })
      .nodeify(done);

    });

  });


  describe('#findInitialRoomUrlForUser', function() {
    var fixture = {};

    before(fixtureLoader(fixture, {
      user1: { },
      user2: { },
      userNoTroupes: { },
      troupe1: { users: ['user1'] },
      troupeOneToOne: { oneToOne: true, users: ['user1', 'user2'] },
    }));

    after(function() {
      fixture.cleanup();
    });

    it('#01 should return null when a user has no troupes',function(done) {

      return recentRoomService.saveLastVisitedTroupeforUserId(fixture.userNoTroupes.id, fixture.troupe1.id)
        .then(function() {
          fixture.userNoTroupes.lastTroupe = fixture.troupe1.id;
          return recentRoomService.findInitialRoomUrlForUser(fixture.userNoTroupes);
        })
        .then(function(url) {
          assert(url === null, 'Expected the url to be null');
        })
        .nodeify(done);

    });

    it('#02 should return return the users last troupe when they have one',function(done) {
      return recentRoomService.saveLastVisitedTroupeforUserId(fixture.user1.id, fixture.troupe1.id)
        .then(function() {
          return recentRoomService.findInitialRoomUrlForUser(fixture.user1);
        })
        .then(function(url) {
          assert.strictEqual(url, '/' + fixture.troupe1.uri);
        })
        .nodeify(done);
    });


    it('#03 should return the users something when the user has troupes, but no last troupe',function(done) {
      return recentRoomService.findInitialRoomUrlForUser(fixture.user1)
        .then(function(url) {
          assert(url !== null, 'Expected the troupe not to be null');
        })
        .nodeify(done);
    });

    it('#04 should return one to one rooms',function(done) {
      return recentRoomService.saveLastVisitedTroupeforUserId(fixture.user1.id, fixture.troupeOneToOne.id)
        .then(function() {
          return recentRoomService.findInitialRoomUrlForUser(fixture.user1);
        })
        .then(function(url) {
          assert.strictEqual(url, '/' + fixture.user2.username);

        })
        .nodeify(done);
    });

  });



});
