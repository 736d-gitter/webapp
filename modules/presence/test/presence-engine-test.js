"use strict";

var assert          = require('assert');
var presenceService = require('..');
var mockito         = require('jsmockito').JsMockito;
var never           = mockito.Verifiers.never;
var hamcrest        = require('jshamcrest').JsHamcrest;
var anything        = hamcrest.Matchers.anything;

var fakeEngine = {
  clientExists: function(clientId, callback) { callback(!clientId.match(/^TEST/)); }
};

describe('presenceService', function() {

  function cleanup(done) {
    presenceService.collectGarbage(fakeEngine, function(err) {
      if(err) return done(err);

      presenceService.validateUsers(function() {
        return done();
      });

    });
  }

  beforeEach(cleanup);
  afterEach(cleanup);

  it('should cleanup invalid sockets correctly', function(done) {
    presenceService.listOnlineUsers()
      .then(function(users) {
        var noTestUsersOnline = users.length === 0 || users.every(function(id) { return !id.match(/^TEST/); });

        assert(noTestUsersOnline, 'Garbage collection does not seem to have run correctly ' + users.join(', '));
      }).nodeify(done);
  });

  it('should allow a user to connect', function(done) {
    var userId = 'TESTUSER1' + Date.now();
    var socketId = 'TESTSOCKET1' + Date.now();
    presenceService.userSocketConnected(userId, socketId, 'online', 'test', null, null, function(err) {
      if(err) return done(err);

      done();
    });
  });

  it('should allow a user to connect and then disconnect', function(done) {
    var userId = 'TESTUSER1' + Date.now();
    var socketId = 'TESTSOCKET1' + Date.now();
    presenceService.userSocketConnected(userId, socketId, 'online', 'test', null, null, function(err) {
      if(err) return done(err);

      presenceService.socketDisconnected(socketId, function(err) {
        done(err);
      });

    });
  });


  it('users presence should appear and disappear as expected', function(done) {
    var userId = 'TESTUSER1' + Date.now();
    var socketId = 'TESTSOCKET1' + Date.now();
    var troupeId = 'TESTTROUPE1' + Date.now();

    // Make sure things are clean
    presenceService.findOnlineUsersForTroupe(troupeId, function(err, users) {
      if(err) return done(err);

      // User should not exist
      assert(users.length === 0 || users.every(function(id) { return id !== userId; }), 'Expected user _not_ to be online at beginning of test: ', users.join(', '));

      // Connect the socket
      presenceService.userSocketConnected(userId, socketId, 'online', 'test', troupeId, true, function(err) {
        if(err) return done(err);

        // Check that the lookup code is working as expected
        presenceService.lookupUserIdForSocket(socketId, function(err, returnedUserId) {
          if(err) return done(err);

          assert(returnedUserId === userId);

          // Make sure that the user appears online
          presenceService.findOnlineUsersForTroupe(troupeId, function(err, users) {
            if(err) return done(err);

            assert(users.some(function(id) { return id === userId; }), 'Expected user to be online');

            // Disconnect the socket
            presenceService.socketDisconnected(socketId, function(err) {
              if(err) return done(err);

              // Check if the user is still in the troupe
              presenceService.findOnlineUsersForTroupe(troupeId, function(err, users) {
                if(err) return done(err);

                var notThere = (!users.length || users.every(function(id) { return id !== userId; }));

                assert(notThere, 'Expect user to be offline: online users are: ' + users.join(', '));

                done();
              });

            });
          });
        });
      });
    });


  });


  it('users presence should remain offline if they subscribe to a troupe while offline', function(done) {
    var userId = 'TESTUSER1' + Date.now();
    var socketId = 'TESTSOCKET1' + Date.now();
    var troupeId = 'TESTTROUPE1' + Date.now();

    // Make sure things are clean
    presenceService.findOnlineUsersForTroupe(troupeId, function(err, users) {
      if(err) return done(err);

      // User should not exist
      assert(users.length === 0 || users.every(function(id) { return id !== userId; }), 'Expected user _not_ to be online at beginning of test: ', users.join(', '));

      // Connect the socket
      presenceService.userSocketConnected(userId, socketId, 'online', 'test', troupeId, false, function(err) {
        if(err) return done(err);

        // Make sure that the user appears online
        presenceService.findOnlineUsersForTroupe(troupeId, function(err, users) {
          if(err) return done(err);

          assert(users.indexOf(userId) === -1, 'Expected user to be offline');

          presenceService.clientEyeballSignal(userId, socketId, 1, function(err) {
            if(err) return done(err);

            // Make sure that the user appears online
            presenceService.findOnlineUsersForTroupe(troupeId, function(err, users) {
              if(err) return done(err);

              assert(users.indexOf(userId) !== -1, 'Expected user to be online');

              done();
            });
          });

        });
      });
    });
  });

  it('should handle very quick connect/disconnect cycles when the user connects to a troupe', function(done) {
    var userId = 'TESTUSER2' + Date.now();
    var socketId = 'TESTSOCKET2' + Date.now();
    var troupeId = 'TESTTROUPE2' + Date.now();

    // This simulates three events happening in very quick succession
    presenceService.userSocketConnected(userId, socketId, 'online', 'test', troupeId, true, function(err) {
      if(err) { return done(err); }

      presenceService.socketDisconnected(socketId, function() {

        presenceService.categorizeUsersByOnlineStatus([userId], function(err, statii) {
          assert(!statii[userId]);

          presenceService.listOnlineUsersForTroupes([troupeId], function(err, troupeOnlineUsers) {
            assert(troupeOnlineUsers[troupeId].length === 0);

            done();
          });

        });

      });
    });

  });


  it('should handle eye-balls-on, eyes-balls-off', function(done) {
    var userId = 'TESTUSER3' + Date.now();
    var socketId = 'TESTSOCKET3' + Date.now();
    var troupeId = 'TESTTROUPE3' + Date.now();

    function assertUserTroupeStatus(inTroupe, callback) {
      // Make sure that the user appears online
      presenceService.findOnlineUsersForTroupe(troupeId, function(err, users) {
        if(err) return done(err);

        if(inTroupe) {
          assert(users.some(function(id) { return id === userId; }), 'Expected user to be online');
        } else {
          assert(users.every(function(id) { return id !== userId; }), 'Expected user not to be online (OFFLINE)');
        }

        callback();
      });
    }

    // To start off, the user should not be in the troupe
    assertUserTroupeStatus(false, function() {

      // Connect socket
      presenceService.userSocketConnected(userId, socketId, 'online', 'test', troupeId, true, function(err) {
        if(err) return done(err);

        // Now the user should be online
        assertUserTroupeStatus(true, function() {
          // Signal user as not focused
          presenceService.clientEyeballSignal(userId, socketId, 0, function(err) {
            if(err) return done(err);

            // Should not be in troupe
            assertUserTroupeStatus(false, function() {

              // Signal user as being back in troupe
              presenceService.clientEyeballSignal(userId, socketId, 1, function(err) {
                if(err) return done(err);

                // User should be in troupe
                assertUserTroupeStatus(true, function() {

                  // Disconnect socket
                  presenceService.socketDisconnected(socketId, function(err) {
                    if(err) return done(err);

                    // USer should not be in troupe
                    assertUserTroupeStatus(false, function() {
                      done();

                    });

                  });
                });
              });
            });
          });
        });
      });
    });
  });


  it('should handle incorrect eyeball signals', function(done) {

    function assertUserTroupeStatus(inTroupe, callback) {
      // Make sure that the user appears online
      presenceService.findOnlineUsersForTroupe(troupeId, function(err, users) {
        if(err) return done(err);

        if(inTroupe) {
          assert(users.some(function(id) { return id === userId; }), 'Expected user to be online');
        } else {
          assert(users.every(function(id) { return id !== userId; }), 'Expected user not to be online (OFFLINE)');
        }

        callback();
      });
    }

    var userId = 'TESTUSER4' + Date.now();
    var socketId = 'TESTSOCKET4' + Date.now();
    var troupeId = 'TESTTROUPE4' + Date.now();

    // Connect socket
    presenceService.userSocketConnected(userId, socketId, 'online', 'test', troupeId, true, function(err) {
      if(err) return done(err);

      var signals = [1,0,1,0,1,1,1,1,0,0,0,1];

      function doNext() {
        if(signals.length <= 0) return done();
        var signal = signals.shift();

        presenceService.clientEyeballSignal(userId, socketId, signal, function(err) {
          assertUserTroupeStatus(signal, function(err, done) {
            if(err) return done(err);
            doNext();
          });
        });
      }
      doNext();

    });

  });

  it('should garbage collect invalid sockets', function(done) {
    var userId = 'TESTUSER4' + Date.now();
    var socketId = 'TESTSOCKET4' + Date.now();

    presenceService.userSocketConnected(userId, socketId, 'online', 'test', null, null, function(err) {
      if(err) return done(err);
      presenceService.collectGarbage(fakeEngine, function(err, count) {
        if(err) return done(err);

        assert(count === 1, 'Expected one invalid socket to be deleted');

        presenceService.listOnlineUsers(function(err, users) {
          if(err) return done(err);
          assert(users.indexOf(userId) === -1, 'User should not be online');
          done();
        });
      });
    });

  });

  it('should not show mobile users as online', function(done) {
    var userId = 'TESTUSER4' + Date.now();
    var socketId = 'TESTSOCKET4' + Date.now();

    presenceService.userSocketConnected(userId, socketId, 'mobile', 'test', null, null, function(err) {
      if(err) return done(err);

      presenceService.listOnlineUsers(function(err, users) {
        if(err) return done(err);
        assert(users.indexOf(userId) === -1, 'User should not be online');

        done();
      });
    });

  });

  it('should categorise mobile users as mobile', function(done) {
    var userId = 'TESTUSER5' + Date.now();
    var socketId = 'TESTSOCKET5' + Date.now();

    presenceService.userSocketConnected(userId, socketId, 'mobile', 'test', null, null)
      .then(function() {
        return presenceService.categorizeUsersByOnlineStatus([userId]);
      })
      .then(function(categorised) {
        var expected = {};
        expected[userId] = 'mobile';
        assert.deepEqual(expected, categorised);
      })
      .nodeify(done);


  });

  it('should show mobile users in a troupe as in the troupe', function(done) {
    var userId = 'TESTUSER4' + Date.now();
    var socketId = 'TESTSOCKET4' + Date.now();
    var troupeId = 'TESTTROUPE4' + Date.now();

    presenceService.userSocketConnected(userId, socketId, 'mobile', 'test', troupeId, true, function(err) {
      if(err) return done(err);

      presenceService.findOnlineUsersForTroupe(troupeId, function(err, users) {
        if(err) return done(err);

        assert(users.some(function(id) { return id === userId; }), 'Expected user to be online');

        presenceService.clientEyeballSignal(userId, socketId, 0, function(err) {
          if(err) return done(err);

          presenceService.findOnlineUsersForTroupe(troupeId, function(err, users) {
            if(err) return done(err);

            assert(users.every(function(id) { return id !== userId; }), 'Expected user not to be online (OFFLINE)');

            done();
          });

        });

      });
    });

  });


  it('should handle users who are online and mobile concurrently correctly', function(done) {
    var userId = 'TESTUSER4' + Date.now();
    var socketId1 = 'TESTSOCKET4' + Date.now();
    var socketId2 = 'TESTSOCKET5' + Date.now();
    var troupeId = 'TESTTROUPE4' + Date.now();

    function ensureUserOnlineStatus(online, cb) {
      presenceService.listOnlineUsers(function(err, users) {
        if(err) return done(err);

        if(online) {
          assert(users.some(function(id) { return id === userId; }), 'Expected user to be online');
        } else {
          assert(users.every(function(id) { return id !== userId; }), 'Expected user not to be online (OFFLINE)');
        }

        cb();
      });
    }

    function ensureUserTroupeStatus(inTroupe, callback) {
      // Make sure that the user appears online
      presenceService.findOnlineUsersForTroupe(troupeId, function(err, users) {
        if(err) return done(err);

        if(inTroupe) {
          assert(users.some(function(id) { return id === userId; }), 'Expected user to be in the troupe' + users.join(', '));
        } else {
          assert(users.every(function(id) { return id !== userId; }), 'Expected user not to be in the troupe: ' + users.join(', '));
        }

        callback();
      });
    }

    presenceService.userSocketConnected(userId, socketId1, 'mobile', 'test', troupeId, true, function(err) {
      if(err) return done(err);

      ensureUserTroupeStatus(true, function() {

        presenceService.userSocketConnected(userId, socketId2, 'online', 'test', troupeId, true, function(err) {
          if(err) return done(err);

          ensureUserOnlineStatus(true, function() {

            presenceService.clientEyeballSignal(userId, socketId2, 0, function(err) {
              if(err) return done(err);

              // User is still online, but not in the troupe

              ensureUserOnlineStatus(true, function() {

                // At this moment, the mobile eyeball is still on,
                ensureUserTroupeStatus(true, function() {

                  // Turn mobile eyeball off
                  presenceService.clientEyeballSignal(userId, socketId1, 0, function(err) {
                    if(err) return done(err);

                    ensureUserTroupeStatus(false, function() {

                      done();

                    });
                  });
                });
              });

            });



          });

        });

      });


    });

  });

  it('should validate sockets', function(done) {
    presenceService.validateUsers(done);
  });

  it('should correct sockets', function(done) {
    var userId = 'TESTUSER4' + Date.now();
    var socketId = 'TESTSOCKET5' + Date.now();
    var troupeId = 'TESTTROUPE4' + Date.now();
    presenceService.userSocketConnected(userId, socketId, 'online', 'test', null, null, function(err) {
      if(err) return done(err);

      var redisClient = presenceService.testOnly.redisClient;

      // Now mess things up intentionally
      redisClient.zincrby(presenceService.testOnly.ACTIVE_USERS_KEY, 1, userId, function(err) {
        if(err) return done(err);
        presenceService.validateUsers(function(err) {
          if(err) done(err);

          presenceService.socketDisconnected(socketId, function(err) {
            if(err) return done(err);

            presenceService.listOnlineUsers(function(err, users) {
              if(err) return done(err);

              assert(users.every(function(id) { return id !== userId; }), 'Expected user not to be in the troupe: ' + users.join(', '));

              done();
            });
          });
        });

      });
    });

  });

  it('should correct sockets for multiple users', function(done) {
    var userId1 = 'TESTUSER1' + Date.now();
    var userId2 = 'TESTUSER2' + Date.now();
    var socketId1 = 'TESTSOCKET1' + Date.now();
    var socketId2 = 'TESTSOCKET2' + Date.now();
    var troupeId = 'TESTTROUPE1' + Date.now();

    presenceService.userSocketConnected(userId1, socketId1, 'online', 'test', null, null, function(err) {
      presenceService.userSocketConnected(userId2, socketId2, 'mobile', 'test', null, null, function(err) {
        if(err) return done(err);

        var redisClient = presenceService.testOnly.redisClient;

        // Now mess things up intentionally
        redisClient.zincrby(presenceService.testOnly.ACTIVE_USERS_KEY, 1, userId2, function(err) {
          if(err) return done(err);

          redisClient.zincrby(presenceService.testOnly.MOBILE_USERS_KEY, 1, userId1, function(err) {
            if(err) return done(err);

            presenceService.validateUsers(function(err) {
              if(err) done(err);

              presenceService.socketDisconnected(socketId1, function(err) {
                if(err) return done(err);

                presenceService.socketDisconnected(socketId2, function(err) {
                  if(err) return done(err);

                  presenceService.listOnlineUsers(function(err, users) {
                    if(err) return done(err);

                    assert(users.every(function(id) { return id !== userId1; }), 'Expected user not to be in the troupe: ' + users.join(', '));
                    assert(users.every(function(id) { return id !== userId2; }), 'Expected user not to be in the troupe: ' + users.join(', '));

                    done();
                  });
                });


              });
            });

          });

        });

      });
    });

  });

  it('should abort the transaction when correcting the socket and an event occurs for the user', function(done) {
    var userId = 'TESTUSER4' + Date.now();
    var socketId = 'TESTSOCKET5' + Date.now();

    presenceService.userSocketConnected(userId, socketId, 'online', 'test', null, null, function(err) {
      if(err) return done(err);

      var redisClient = presenceService.testOnly.redisClient;

      // now mess things up intentionally
      redisClient.zincrby(presenceService.testOnly.ACTIVE_USERS_KEY, 1, userId, function(err) {
        if(err) return done(err);

        presenceService.testOnly.forceDelay = true;
        presenceService.testOnly.onAfterDelay = function() {
          return presenceService.socketDisconnected(socketId);
        };

        presenceService.testOnly.validateUsersSubset([userId], function(err) {
          presenceService.testOnly.forceDelay = false;
          presenceService.testOnly.onAfterDelay = null;

          assert(err, 'Expected an error');
          assert(err.rollback, 'Expected a transaction rollback');
          done();
        });


      });
    });

  });


  it('should correctly categorize users who are online and offline', function(done) {
    var userId1 = 'TESTUSER1' + Date.now();
    var socketId1 = 'TESTSOCKET1' + Date.now();
    var userId2 = 'TESTUSER2' + Date.now();
    var socketId2 = 'TESTSOCKET2' + Date.now();

    presenceService.userSocketConnected(userId1, socketId1, 'online', 'test', null, null, function(err) {
      if(err) return done(err);

      presenceService.userSocketConnected(userId2, socketId2, 'online', 'test', null, null, function(err) {
        if(err) return done(err);
        presenceService.categorizeUsersByOnlineStatus([userId1, userId2], function(err, c) {
          if(err) return done(err);

          assert.equal(c[userId1], 'online');
          assert.equal(c[userId2], 'online');
          done();
        });
      });
    });
  });


  it('should correctly categorize userstroupe who are introupe, online and offline', function(done) {
    var userId1 = 'TESTUSER1' + Date.now();
    var socketId1 = 'TESTSOCKET1' + Date.now();
    var userId2 = 'TESTUSER2' + Date.now();
    var socketId2 = 'TESTSOCKET2' + Date.now();
    var troupeId = 'TESTTROUPE1' + Date.now();
    var userId3 = 'TESTUSER3' + Date.now();

    presenceService.userSocketConnected(userId1, socketId1, 'online', 'test', troupeId, true, function(err) {
      if(err) return done(err);

      presenceService.userSocketConnected(userId2, socketId2, 'online', 'test', null, null, function(err) {
        if(err) return done(err);

        presenceService.categorizeUserTroupesByOnlineStatus([
            {userId: userId1, troupeId: troupeId },
            {userId: userId2, troupeId: troupeId },
            {userId: userId3, troupeId: troupeId }
            ], function(err, c) {

          if(err) return done(err);

          try {

            assert.equal(c.inTroupe.length, 1);
            assert.equal(c.inTroupe[0].userId, userId1);
            assert.equal(c.inTroupe[0].troupeId, troupeId);

            assert.equal(c.online.length, 1);
            assert.equal(c.online[0].userId, userId2);
            assert.equal(c.online[0].troupeId, troupeId);


            assert.equal(c.offline.length, 1);
            assert.equal(c.offline[0].userId, userId3);
            assert.equal(c.offline[0].troupeId, troupeId);

          } catch(e) {
            console.error(e);
            throw e;
          }

          done();
        });


      });
    });
  });

  it('user sockets list should be correctly maintained', function(done) {
    var userId = 'TESTUSER1' + Date.now();
    var socketId = 'TESTSOCKET1' + Date.now();
    var troupeId = 'TESTTROUPE1' + Date.now();

    // Connect the socket
    presenceService.userSocketConnected(userId, socketId, 'online', 'test', troupeId, true, function(err) {
      if(err) return done(err);

      presenceService.findAllSocketsForUserInTroupe(userId, troupeId, function(err, socketIds) {
        if(err) return done(err);

        assert.equal(socketIds.length, 1);
        assert.equal(socketIds[0], socketId);

        // Disconnect the socket
        presenceService.socketDisconnected(socketId, function(err) {
          if(err) return done(err);

          presenceService.findAllSocketsForUserInTroupe(userId, troupeId, function(err, socketIds) {
            if(err) return done(err);

            assert.equal(socketIds.length, 0);
            done();
          });

        });

      });


    });


  });


  it('findAllSocketsForUserInTroupe should work correctly', function(done) {
    var userId = 'TESTUSER1' + Date.now();
    var socketId = 'TESTSOCKET1' + Date.now();
    var troupeId = 'TESTTROUPE1' + Date.now();

    // Connect the socket
    presenceService.userSocketConnected(userId, socketId, 'online', 'test', null, null, function(err) {
      if(err) return done(err);

      presenceService.listAllSocketsForUser(userId, function(err, socketIds) {
        if(err) return done(err);

        assert.equal(socketIds.length, 1);
        assert.equal(socketIds[0], socketId);

        // Disconnect the socket
        presenceService.socketDisconnected(socketId, function(err) {
          if(err) return done(err);

          presenceService.listAllSocketsForUser(userId, function(err, socketIds) {
            if(err) return done(err);

            assert.equal(socketIds.length, 0);
            done();
          });

        });

      });

    });

  });

  it('socketExists should work correctly', function(done) {
    var userId = 'TESTUSER1' + Date.now();
    var socketId = 'TESTSOCKET1' + Date.now();
    var socketId2 = 'TESTSOCKET2' + Date.now();
    var troupeId = 'TESTTROUPE1' + Date.now();

    // Connect the socket
    presenceService.userSocketConnected(userId, socketId, 'online', 'test', null, null, function(err) {
      if(err) return done(err);

      presenceService.socketExists(socketId, function(err, exists) {
        if(err) return done(err);

        assert(exists);

        // Disconnect the socket
        presenceService.socketDisconnected(socketId, function(err, exists) {
          if(err) return done(err);

          assert(!exists);

          presenceService.socketExists(socketId2, function(err, exists) {
            if(err) return done(err);

            assert(!exists);

            done();
          });

        });

      });

    });


  });

  describe('socketReassociated', function() {
    var userId, socketId, troupeId, troupeId2, presenceChangeMock, eyeballSignalMock;

    beforeEach(function() {
      userId = 'TESTUSER1' + Date.now();
      socketId = 'TESTSOCKET1' + Date.now();
      troupeId = 'TESTTROUPE1' + Date.now();
      troupeId2 = 'TESTTROUPE2' + Date.now();

      presenceChangeMock = mockito.mockFunction();
      eyeballSignalMock = mockito.mockFunction();

      presenceService.on('presenceChange', presenceChangeMock);
      presenceService.on('eyeballSignal', eyeballSignalMock);
    });

    afterEach(function() {
      presenceService.removeListener('presenceChange', presenceChangeMock);
      presenceService.removeListener('eyeballSignal', eyeballSignalMock);
    });

    describe('non-anonymous', function() {

      it('should reassociate a socket correctly', function(done) {
        return presenceService.userSocketConnected(userId, socketId, 'online', 'test', troupeId, true)
          .then(function() {
            // Validate user is in troupe1
            return presenceService.listOnlineUsersForTroupes([troupeId]);
          })
          .then(function(online) {
            mockito.verify(presenceChangeMock)(userId, troupeId, true);

            assert.deepEqual(online[troupeId], [userId]);
            return presenceService.socketReassociated(socketId, userId, troupeId2, true);
          })
          .then(function() {
            mockito.verify(presenceChangeMock)(userId, troupeId, false);
            mockito.verify(presenceChangeMock)(userId, troupeId2, true);

            // Validate new presence
            return presenceService.listOnlineUsersForTroupes([troupeId, troupeId2]);
          })
          .then(function(online) {
            assert.deepEqual(online[troupeId], []);
            assert.deepEqual(online[troupeId2], [userId]);

            // Validate details on socket
            return presenceService.getSocket(socketId);
          })
          .then(function(socket) {
            assert.strictEqual(socket.userId, userId);
            assert.strictEqual(socket.troupeId, troupeId2);
            assert.strictEqual(socket.eyeballs, true);
            assert.strictEqual(socket.clientType, 'test');
          })
          .nodeify(done);
      });

      it('should reassociate a socket when previously there was no socket', function(done) {
        return presenceService.userSocketConnected(userId, socketId, 'online', 'test', null, true)
          .then(function() {
            // Validate user is in troupe1
            return presenceService.listOnlineUsersForTroupes([troupeId]);
          })
          .then(function(online) {
            mockito.verify(presenceChangeMock, never())(userId, troupeId, true);
            assert.deepEqual(online[troupeId], []);
            return presenceService.socketReassociated(socketId, userId, troupeId2, true);
          })
          .then(function() {
            mockito.verify(presenceChangeMock, never())(userId, troupeId, false);
            mockito.verify(presenceChangeMock)(userId, troupeId2, true);

            // Validate new presence
            return presenceService.listOnlineUsersForTroupes([troupeId, troupeId2]);
          })
          .then(function(online) {
            assert.deepEqual(online[troupeId], []);
            assert.deepEqual(online[troupeId2], [userId]);

            // Validate details on socket
            return presenceService.getSocket(socketId);
          })
          .then(function(socket) {
            assert.strictEqual(socket.userId, userId);
            assert.strictEqual(socket.troupeId, troupeId2);
            assert.strictEqual(socket.eyeballs, true);
            assert.strictEqual(socket.clientType, 'test');
          })
          .nodeify(done);
      });

      it('should clear a socket troupe association', function(done) {
        return presenceService.userSocketConnected(userId, socketId, 'online', 'test', troupeId, true)
          .then(function() {
            // Validate user is in troupe1
            return presenceService.listOnlineUsersForTroupes([troupeId]);
          })
          .then(function(online) {
            mockito.verify(presenceChangeMock)(userId, troupeId, true);
            assert.deepEqual(online[troupeId], [userId]);
            return presenceService.socketReassociated(socketId, userId, null, true); // Eyeballs true here is incorrect but deliberate as clients can make mistakes
          })
          .then(function() {
            mockito.verify(presenceChangeMock)(userId, troupeId, false);
            mockito.verify(presenceChangeMock, never())(userId, troupeId2, true);

            // Validate new presence
            return presenceService.listOnlineUsersForTroupes([troupeId, troupeId2]);
          })
          .then(function(online) {
            assert.deepEqual(online[troupeId], []);
            assert.deepEqual(online[troupeId2], []);

            // Validate details on socket
            return presenceService.getSocket(socketId);
          })
          .then(function(socket) {
            console.log(socket);
            assert.strictEqual(socket.userId, userId);
            assert.strictEqual(socket.troupeId, null);
            assert.strictEqual(socket.eyeballs, false);
            assert.strictEqual(socket.clientType, 'test');
          })
          .nodeify(done);
      });
    });

    describe('anonymous', function() {

      it('should reassociate a socket correctly', function(done) {
        return presenceService.userSocketConnected(null, socketId, 'online', 'test', troupeId, true)
          .then(function() {
            mockito.verify(presenceChangeMock, never())(null, anything(), anything());

            // Validate user is in troupe1
            return presenceService.listOnlineUsersForTroupes([troupeId]);
          })
          .then(function(online) {
            assert.deepEqual(online[troupeId], []);
            return presenceService.socketReassociated(socketId, null, troupeId2, true);
          })
          .then(function() {
            mockito.verify(presenceChangeMock, never())(null, anything(), anything());

            // Validate new presence
            return presenceService.listOnlineUsersForTroupes([troupeId, troupeId2]);
          })
          .then(function(online) {
            assert.deepEqual(online[troupeId], []);
            assert.deepEqual(online[troupeId2], []);

            // Validate details on socket
            return presenceService.getSocket(socketId);
          })
          .then(function(socket) {
            assert.strictEqual(socket.userId, null);
            assert.strictEqual(socket.troupeId, troupeId2);
            assert.strictEqual(socket.eyeballs, false);
            assert.strictEqual(socket.clientType, 'test');
          })
          .nodeify(done);
      });

      it('should reassociate a socket when previously there was no socket', function(done) {
        return presenceService.userSocketConnected(null, socketId, 'online', 'test', null, true)
          .then(function() {
            mockito.verify(presenceChangeMock, never())(null, anything(), anything());

            // Validate user is in troupe1
            return presenceService.listOnlineUsersForTroupes([troupeId]);
          })
          .then(function(online) {
            assert.deepEqual(online[troupeId], []);
            return presenceService.socketReassociated(socketId, null, troupeId2, true);
          })
          .then(function() {
            mockito.verify(presenceChangeMock, never())(null, anything(), anything());

            // Validate new presence
            return presenceService.listOnlineUsersForTroupes([troupeId, troupeId2]);
          })
          .then(function(online) {
            assert.deepEqual(online[troupeId], []);
            assert.deepEqual(online[troupeId2], []);

            // Validate details on socket
            return presenceService.getSocket(socketId);
          })
          .then(function(socket) {
            assert.strictEqual(socket.userId, null);
            assert.strictEqual(socket.troupeId, troupeId2);
            assert.strictEqual(socket.eyeballs, false);
            assert.strictEqual(socket.clientType, 'test');
          })
          .nodeify(done);
      });

      it('should clear a socket troupe association', function(done) {
        return presenceService.userSocketConnected(null, socketId, 'online', 'test', troupeId, true)
          .then(function() {
            mockito.verify(presenceChangeMock, never())(null, anything(), anything());

            // Validate user is in troupe1
            return presenceService.listOnlineUsersForTroupes([troupeId]);
          })
          .then(function(online) {
            mockito.verify(presenceChangeMock, never())(null, anything(), anything());
            assert.deepEqual(online[troupeId], []);
            return presenceService.socketReassociated(socketId, null, null, true); // Eyeballs true here is incorrect but deliberate as clients can make mistakes
          })
          .then(function() {
            mockito.verify(presenceChangeMock, never())(null, anything(), anything());

            // Validate new presence
            return presenceService.listOnlineUsersForTroupes([troupeId, troupeId2]);
          })
          .then(function(online) {
            assert.deepEqual(online[troupeId], []);
            assert.deepEqual(online[troupeId2], []);

            // Validate details on socket
            return presenceService.getSocket(socketId);
          })
          .then(function(socket) {
            console.log(socket);
            assert.strictEqual(socket.userId, null);
            assert.strictEqual(socket.troupeId, null);
            assert.strictEqual(socket.eyeballs, false);
            assert.strictEqual(socket.clientType, 'test');
          })
          .nodeify(done);
      });
    });

  });

});
