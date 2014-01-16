/*jslint node:true, unused:true*/
/*global describe:true, it:true, before:true, after: true */
"use strict";

var testRequire = require('../test-require');
var assert = require('assert');
var Q = require('q');
var fixtureLoader = require('../test-fixtures');

var fixture = {};

before(fixtureLoader(fixture, {
  user1: { permissions: { createRoom: true } },
  userNoTroupes: { },
  troupe1: { users: ['user1'] },
  troupe2: { users: ['user1'] },
  troupe3: { users: ['user1'] },
  troupe4: { users: ['user1'] },
}));

after(function() {
  fixture.cleanup();
});

var recentRoomService = testRequire("./services/recent-room-service");
var persistenceService = testRequire("./services/persistence-service");

describe('recent-room-service', function() {

  it('should rearrange the order of favourites correctly',function(done) {
    function getFavs() {
      return recentRoomService.findFavouriteTroupesForUser(fixture.user1.id);
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

      .nodeify(done);
  });

  it('should generateRoomListForUser with favourites', function(done) {
    return recentRoomService.updateFavourite(fixture.user1.id, fixture.troupe1.id, 2)
      .then(function() {
        return recentRoomService.updateFavourite(fixture.user1.id, fixture.troupe2.id, 1);
      })
      .then(function() {
        return recentRoomService.updateFavourite(fixture.user1.id, fixture.troupe3.id, true);
      })
      .then(function() {
        return recentRoomService.generateRoomListForUser(fixture.user1.id);
      })
      .then(function(roomList) {
        assert.equal(roomList.length, 3);
        assert.equal(roomList[0].id, fixture.troupe2.id);
        assert.equal(roomList[1].id, fixture.troupe1.id);
        assert.equal(roomList[2].id, fixture.troupe3.id);
      })
      .nodeify(done);
  });

  it('should generateRoomListForUser with favourites and recents', function(done) {
    return Q.all([
        recentRoomService.updateFavourite(fixture.user1.id, fixture.troupe1.id, 2),
        recentRoomService.updateFavourite(fixture.user1.id, fixture.troupe2.id, 1),
        recentRoomService.saveLastVisitedTroupeforUserId(fixture.user1.id, fixture.troupe3.id),
        recentRoomService.saveLastVisitedTroupeforUserId(fixture.user1.id, fixture.troupe4.id)
      ])
      .then(function() {
        return recentRoomService.generateRoomListForUser(fixture.user1.id);
      })
      .then(function(roomList) {
        assert.equal(roomList.length, 4);
        assert.equal(roomList[0].id, fixture.troupe2.id);
        assert.equal(roomList[1].id, fixture.troupe1.id);
        assert.equal(roomList[2].id, fixture.troupe3.id);
        assert.equal(roomList[3].id, fixture.troupe4.id);
      })
      .nodeify(done);
  });

  describe('#updateFavourite()', function() {
    it('should add a troupe to favourites',function(done) {

      function fav(val, callback) {
        recentRoomService.updateFavourite(fixture.user1.id, fixture.troupe1.id, val)
          .nodeify(function(err) {
            if(err) return done(err);

            recentRoomService.findFavouriteTroupesForUser(fixture.user1.id, function(err, favs) {
              if(err) return done(err);

              var isInTroupe = !!favs[fixture.troupe1.id];
              assert(isInTroupe === val, 'Troupe should ' + (val? '': 'not ') + 'be a favourite');
              callback();
            });
          });
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
    it('should record the time each troupe was last accessed by a user', function(done) {

      recentRoomService.saveLastVisitedTroupeforUserId(fixture.user1.id, fixture.troupe1.id, function(err) {
        if(err) return done(err);

      persistenceService.User.findById(fixture.user1.id, function(err, user) {
        if(err) return done(err);

        assert.equal(user.lastTroupe, fixture.troupe1.id);

        recentRoomService.getTroupeLastAccessTimesForUser(fixture.user1.id, function(err, times) {
            if(err) return done(err);
            var troupeId = "" + fixture.troupe1.id;

            var after = times[troupeId];
            assert(after, 'Expected a value for last access time');

            recentRoomService.saveLastVisitedTroupeforUserId(fixture.user1.id, fixture.troupe1.id, function(err) {
              if(err) return done(err);

              recentRoomService.getTroupeLastAccessTimesForUser(fixture.user1.id, function(err, times) {
                if(err) return done(err);
                assert(times[troupeId] > after, 'The last access time for this troupe has not changed. Before it was ' + after + ' now it is ' + times[troupeId]);
                done();
              });
            });
          });

        });
      });



    });
  });


  describe('#findBestTroupeForUser', function() {
    it('#01 should return null when a user has no troupes',function(done) {

      recentRoomService.saveLastVisitedTroupeforUserId(fixture.userNoTroupes.id, fixture.troupe1.id, function(err) {
        if(err) return done(err);


        recentRoomService.findBestTroupeForUser(fixture.userNoTroupes, function(err, troupe) {
          if(err) return done(err);
          assert(troupe === null, 'Expected the troupe to be null');
          done();
        });
      });


    });

    it('#02 should return return the users last troupe when they have one',function(done) {
      recentRoomService.saveLastVisitedTroupeforUserId(fixture.user1.id, fixture.troupe1.id, function(err) {
        if(err) return done(err);

        recentRoomService.findBestTroupeForUser(fixture.user1, function(err, troupe) {
          if(err) return done(err);

          assert(troupe !== null, 'Expected the troupe not to be null');
          assert(troupe.uri == fixture.troupe1.uri, 'Expected the troupe uri to be testtroupe1');
          done();
        });

      });

    });


    it('#03 should return the users something when the user has troupes, but no last troupe',function(done) {
      recentRoomService.findBestTroupeForUser(fixture.user1, function(err, troupe) {
        if(err) return done(err);

        assert(troupe !== null, 'Expected the troupe not to be null');
        done();
      });

    });

  });
});
