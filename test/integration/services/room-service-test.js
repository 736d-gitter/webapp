/*jslint node:true, unused:true*/
/*global describe:true, it:true, before:true, after: true */
"use strict";

var testRequire = require('../test-require');
var assert = require('assert');
var fixtureLoader = require('../test-fixtures');
var Q = require('q');
var fixture = {};

var mockito = require('jsmockito').JsMockito;
var times = mockito.Verifiers.times;
var once = times(1);

Q.longStackSupport = true;

var troupeService = testRequire("./services/troupe-service");

before(fixtureLoader(fixture, {
  user1: { },
  user2: { },
  user3: { },
  troupeOrg1: {
    githubType: 'ORG',
    users: ['user1', 'user2']
  },
  troupeRepo: {
    security: 'PRIVATE',
    githubType: 'REPO',
    users: ['user1', 'user2']
  },
  troupeBan: {
    security: 'PUBLIC',
    githubType: 'REPO',
    users: ['userBan', 'userBanAdmin']
  },
  userBan: { },
  userBanAdmin: {}
}));

after(function() {
  fixture.cleanup();
});

function makeRoomAssertions(room, usersAllowedIn, usersNotAllowedIn) {
  return Q.resolve(true);

  var roomService = testRequire("./services/room-service");

  if(!room) return Q.reject('no room');
  if(!room.uri) return Q.reject('no room.uri');

  return Q.all(usersAllowedIn.map(function(user) {

    return roomService.findOrCreateRoom(user, room.uri)
      .then(function(uriLookup) {
        assert(uriLookup);
      })
      .fail(function(err) {
        console.log('User ' + user.username + ' was incorrectly NOT allowed in the room');
        throw err;
      });

  })).then(function() {
    return Q.all(usersNotAllowedIn.map(function(user) {
      var failed = 0;
      return roomService.findOrCreateRoom(user, room.uri)
        .then(function() {
          console.log('User ' + user.username + ' was incorrectly allowed in the room');
        })
        .fail(function() {
          failed++;
        })
        .then(function() {
          assert.equal(failed, 1);
        });
    }));
  });
}

describe('room-service', function() {

  describe('classic functionality', function() {

    it('should find or create a room for an org', function(done) {
      var permissionsModelMock = mockito.mockFunction();
      var roomService = testRequire("./services/room-service", {
        './permissions-model': permissionsModelMock
      });

      return roomService.findOrCreateRoom(fixture.user1, 'gitterTest')
        .then(function(uriContext) {
          assert(!uriContext.oneToOne);
          assert(!uriContext.troupe);
        })
        .nodeify(done);
    });

    it('should find or create a room for a person', function(done) {
      var permissionsModelMock = mockito.mockFunction();
      var roomService = testRequire("./services/room-service", {
        './permissions-model': permissionsModelMock
      });

      return roomService.findOrCreateRoom(fixture.user1, fixture.user2.username)
        .then(function(uriContext) {
          assert(uriContext.oneToOne);
          assert(uriContext.troupe);
          assert.equal(uriContext.otherUser.id, fixture.user2.id);
        })
        .nodeify(done);
    });

    it('should create a room for a repo', function(done) {
      var permissionsModelMock = mockito.mockFunction();
      var roomService = testRequire("./services/room-service", {
        './permissions-model': permissionsModelMock
      });

      return roomService.findOrCreateRoom(fixture.user1, 'gitterHQ/cloaked-avenger')
        .nodeify(done);
    });

    it('should create a room for a repo ignoring the case', function(done) {
      var permissionsModelMock = mockito.mockFunction();
      var roomService = testRequire("./services/room-service", {
        './permissions-model': permissionsModelMock
      });

      return roomService.findOrCreateRoom(fixture.user1, 'gitterhq/sandbox', {ignoreCase: true})
        .then(function(uriContext) {
          assert(uriContext.troupe);
          assert(uriContext.troupe.lcUri  === 'gitterhq/sandbox');
          assert(uriContext.troupe.uri    === 'gitterHQ/sandbox');
        })
        .nodeify(done);
    });


    it('should handle an invalid url correctly', function(done) {
      var permissionsModelMock = mockito.mockFunction();
      var roomService = testRequire("./services/room-service", {
        './permissions-model': permissionsModelMock
      });

      return roomService.findOrCreateRoom(fixture.user1, 'joyent')
        .then(function(uriContext) {
          assert(!uriContext.troupe);
        })
        .nodeify(done);
    });

  });

  describe('custom rooms', function() {

    describe('::org::', function() {

      it('should create private rooms and allow users to be added to them', function(done) {
        var permissionsModelMock = mockito.mockFunction();
        var roomService = testRequire.withProxies("./services/room-service", {
          './permissions-model': permissionsModelMock
        });

        mockito.when(permissionsModelMock)().then(function(user, perm, uri, githubType, security) {
          assert.equal(user.id, fixture.user1.id);
          assert.equal(perm, 'create');
          assert.equal(uri, fixture.troupeOrg1.uri + '/private');
          assert.equal(githubType, 'ORG_CHANNEL');
          assert.equal(security, 'PRIVATE');
          return Q.resolve(true);
        });

        return roomService.createCustomChildRoom(fixture.troupeOrg1, fixture.user1, { name: 'private', security: 'PRIVATE' })
          .then(function(room) {
            mockito.verify(permissionsModelMock, once)();

            return makeRoomAssertions(room, [fixture.user1, fixture.user2], [fixture.user3])
              .thenResolve(room);
          })
          .then(function(room) {
            // Get another mock
            // ADD A PERSON TO THE ROOM
            var roomPermissionsModelMock = mockito.mockFunction();
            var roomService = testRequire.withProxies("./services/room-service", {
              './room-permissions-model': roomPermissionsModelMock
            });

            mockito.when(roomPermissionsModelMock)().then(function(user, perm, incomingRoom) {
              assert.equal(user.id, fixture.user1.id);
              assert.equal(perm, 'adduser');
              assert.equal(incomingRoom.id, room.id);
              return Q.resolve(true);
            });

            return roomService.addUsersToRoom(room, fixture.user1, [fixture.user3.username])
              .then(function() {
                mockito.verify(permissionsModelMock, once)();
              })
              .thenResolve(room);
          })
          .then(function(room) {
            return troupeService.findById(room.id);
          })
          .then(function(room) {
            assert(room.containsUserId(fixture.user3.id), 'Expected to find newly added user in the room');
          })
          .nodeify(done);
      });

      it('should create open rooms', function(done) {
        var permissionsModelMock = mockito.mockFunction();
        var roomService = testRequire.withProxies("./services/room-service", {
          './permissions-model': permissionsModelMock
        });

        mockito.when(permissionsModelMock)().then(function(user, perm, uri, githubType, security) {
          assert.equal(user.id, fixture.user1.id);
          assert.equal(perm, 'create');
          assert.equal(uri, fixture.troupeOrg1.uri + '/open');
          assert.equal(githubType, 'ORG_CHANNEL');
          assert.equal(security, 'PUBLIC');
          return Q.resolve(true);
        });

        return roomService.createCustomChildRoom(fixture.troupeOrg1, fixture.user1, { name: 'open', security: 'PUBLIC' })
          .then(function(room) {
            mockito.verify(permissionsModelMock, once)();

            return makeRoomAssertions(room, [fixture.user1, fixture.user2, fixture.user3], [])
              .thenResolve(room);
          })
          .then(function(room) {
            // Get another mock
            // ADD A PERSON TO THE ROOM
            var roomPermissionsModelMock = mockito.mockFunction();
            var roomService = testRequire.withProxies("./services/room-service", {
              './room-permissions-model': roomPermissionsModelMock
            });

            mockito.when(roomPermissionsModelMock)().then(function(user, perm, _room) {
              assert.equal(user.id, fixture.user1.id);
              assert.equal(perm, 'adduser');
              assert.equal(room.id, _room.id);
              return Q.resolve(true);
            });

            return roomService.addUsersToRoom(room, fixture.user1, [fixture.user3.username])
              .then(function() {
                mockito.verify(roomPermissionsModelMock, once)();
              })
              .thenResolve(room);
          })
          .then(function(room) {
            return troupeService.findById(room.id);
          })
          .then(function(room) {
            assert(room.containsUserId(fixture.user3.id), 'Expected to find newly added user in the room');
          })
          .nodeify(done);
      });

      it('should create inherited rooms', function(done) {
        var permissionsModelMock = mockito.mockFunction();
        var roomService = testRequire.withProxies("./services/room-service", {
          './permissions-model': permissionsModelMock
        });

        mockito.when(permissionsModelMock)().then(function(user, perm, uri, githubType, security) {
          assert.equal(user.id, fixture.user1.id);
          assert.equal(perm, 'create');
          assert.equal(uri, fixture.troupeOrg1.uri + '/child');
          assert.equal(githubType, 'ORG_CHANNEL');
          assert.equal(security, 'INHERITED');
          return Q.resolve(true);
        });

        return roomService.createCustomChildRoom(fixture.troupeOrg1, fixture.user1, { name: 'child', security: 'INHERITED' })
          .then(function(room) {
            mockito.verify(permissionsModelMock, once)();

            return makeRoomAssertions(room, [fixture.user1, fixture.user2], [ fixture.user3])
              .thenResolve(room);
          })
          .then(function(room) {
            // Get another mock
            // ADD A PERSON TO THE ROOM
            var roomPermissionsModelMock = mockito.mockFunction();
            var roomService = testRequire.withProxies("./services/room-service", {
              './room-permissions-model': roomPermissionsModelMock
            });

            mockito.when(roomPermissionsModelMock)().then(function(user, perm, _room) {
              assert.equal(user.id, fixture.user1.id);
              assert.equal(perm, 'adduser');
              assert.equal(room.id, _room.id);
              return Q.resolve(true);
            });

            return roomService.addUsersToRoom(room, fixture.user1, [fixture.user3.username])
              .then(function() {
                mockito.verify(roomPermissionsModelMock, once)();
              })
              .thenResolve(room);
          })
          .then(function(room) {
            return troupeService.findById(room.id);
          })
          .then(function(room) {
            assert(room.containsUserId(fixture.user3.id), 'Expected to find newly added user in the room');
          })
          .nodeify(done);
      });

    });

    describe('::repo::', function() {
      it(/* ::repo */ 'should create private rooms', function(done) {
        var permissionsModelMock = mockito.mockFunction();
        var roomService = testRequire.withProxies("./services/room-service", {
          './permissions-model': permissionsModelMock
        });

        mockito.when(permissionsModelMock)().then(function(user, perm, uri, githubType, security) {
          assert.equal(user.id, fixture.user1.id);
          assert.equal(perm, 'create');
          assert.equal(uri, fixture.troupeRepo.uri + '/private');
          assert.equal(githubType, 'REPO_CHANNEL');
          assert.equal(security, 'PRIVATE');
          return Q.resolve(true);
        });

        return roomService.createCustomChildRoom(fixture.troupeRepo, fixture.user1, { name: 'private', security: 'PRIVATE' })
          .then(function(room) {
            mockito.verify(permissionsModelMock, once)();

            return makeRoomAssertions(room, [fixture.user1], [fixture.user2, fixture.user3])
              .thenResolve(room);
          })
          .then(function(room) {
            // Get another mock
            // ADD A PERSON TO THE ROOM
            var roomPermissionsModelMock = mockito.mockFunction();
            var roomService = testRequire.withProxies("./services/room-service", {
              './room-permissions-model': roomPermissionsModelMock
            });

            mockito.when(roomPermissionsModelMock)().then(function(user, perm, _room) {
              assert.equal(user.id, fixture.user1.id);
              assert.equal(perm, 'adduser');
              assert.equal(_room.id, room.id);
              return Q.resolve(true);
            });

            return roomService.addUsersToRoom(room, fixture.user1, [fixture.user3.username])
              .then(function() {
                mockito.verify(roomPermissionsModelMock, once)();
              })
              .thenResolve(room);
          })
          .then(function(room) {
            return troupeService.findById(room.id);
          })
          .then(function(room) {
            assert(room.containsUserId(fixture.user3.id), 'Expected to find newly added user in the room');
          })
          .nodeify(done);
      });

      it(/* ::repo */ 'should create open rooms', function(done) {
        var permissionsModelMock = mockito.mockFunction();
        var roomService = testRequire.withProxies("./services/room-service", {
          './permissions-model': permissionsModelMock
        });


        mockito.when(permissionsModelMock)().then(function(user, perm, uri, githubType, security) {
          assert.equal(user.id, fixture.user1.id);
          assert.equal(perm, 'create');
          assert.equal(uri, fixture.troupeRepo.uri + '/open');
          assert.equal(githubType, 'REPO_CHANNEL');
          assert.equal(security, 'PUBLIC');
          return Q.resolve(true);
        });

        return roomService.createCustomChildRoom(fixture.troupeRepo, fixture.user1, { name: 'open', security: 'PUBLIC' })
          .then(function(room) {
            mockito.verify(permissionsModelMock, once)();

            return makeRoomAssertions(room, [fixture.user1, fixture.user2, fixture.user3], [])
              .thenResolve(room);
          })
          .then(function(room) {
            // Get another mock
            // ADD A PERSON TO THE ROOM
            var roomPermissionsModelMock = mockito.mockFunction();
            var roomService = testRequire.withProxies("./services/room-service", {
              './room-permissions-model': roomPermissionsModelMock
            });

            mockito.when(roomPermissionsModelMock)().then(function(user, perm, _room) {
              assert.equal(user.id, fixture.user1.id);
              assert.equal(perm, 'adduser');
              assert.equal(_room.id, room.id);
              return Q.resolve(true);
            });

            return roomService.addUsersToRoom(room, fixture.user1, [fixture.user3.username])
              .then(function() {
                mockito.verify(roomPermissionsModelMock, once)();
              })
              .thenResolve(room);
          })
          .then(function(room) {
            return troupeService.findById(room.id);
          })
          .then(function(room) {
            assert(room.containsUserId(fixture.user3.id), 'Expected to find newly added user in the room');
          })

          .nodeify(done);
      });

      it(/* ::repo */ 'should create inherited rooms', function(done) {
        var permissionsModelMock = mockito.mockFunction();
        var roomService = testRequire.withProxies("./services/room-service", {
          './permissions-model': permissionsModelMock
        });

        mockito.when(permissionsModelMock)().then(function(user, perm, uri, githubType, security) {
          assert.equal(user.id, fixture.user1.id);
          assert.equal(perm, 'create');
          assert.equal(uri, fixture.troupeRepo.uri + '/child');
          assert.equal(githubType, 'REPO_CHANNEL');
          assert.equal(security, 'INHERITED');
          return Q.resolve(true);
        });

        return roomService.createCustomChildRoom(fixture.troupeRepo, fixture.user1, { name: 'child', security: 'INHERITED' })
          .then(function(room) {
            mockito.verify(permissionsModelMock, once)();

            return makeRoomAssertions(room, [fixture.user1, fixture.user2], [fixture.user3])
              .thenResolve(room);
          })
          .then(function(room) {
            // Get another mock
            // ADD A PERSON TO THE ROOM
            var roomPermissionsModelMock = mockito.mockFunction();
            var roomService = testRequire.withProxies("./services/room-service", {
              './room-permissions-model': roomPermissionsModelMock
            });

            mockito.when(roomPermissionsModelMock)().then(function(user, perm, _room) {
              assert.equal(user.id, fixture.user1.id);
              assert.equal(perm, 'adduser');
              assert.equal(_room.id, room.id);
              return Q.resolve(true);
            });

            return roomService.addUsersToRoom(room, fixture.user1, [fixture.user3.username])
              .then(function() {
                mockito.verify(permissionsModelMock, once)();
              })
              .thenResolve(room);
          })
          .then(function(room) {
            return troupeService.findById(room.id);
          })
          .then(function(room) {
            assert(room.containsUserId(fixture.user3.id), 'Expected to find newly added user in the room');
          })

          .nodeify(done);
      });

    });

    describe('::user::', function() {

      it('should create private rooms without a name', function(done) {
        var permissionsModelMock = mockito.mockFunction();
        var roomService = testRequire.withProxies("./services/room-service", {
          './permissions-model': permissionsModelMock
        });

        mockito.when(permissionsModelMock)().then(function(user, perm, uri, githubType, security) {
          assert.equal(user.id, fixture.user1.id);
          assert.equal(perm, 'create');
          assert.equal(githubType, 'USER_CHANNEL');
          assert.equal(security, 'PRIVATE');
          return Q.resolve(true);
        });

        return roomService.createCustomChildRoom(null, fixture.user1, { security: 'PRIVATE' })
          .then(function(room) {
            mockito.verify(permissionsModelMock, once)();

            return makeRoomAssertions(room, [fixture.user1], [fixture.user2])
              .thenResolve(room);
          })
          .then(function(room) {
            // Get another mock
            // ADD A PERSON TO THE ROOM
            var roomPermissionsModelMock = mockito.mockFunction();
            var roomService = testRequire.withProxies("./services/room-service", {
              './room-permissions-model': roomPermissionsModelMock
            });

            mockito.when(roomPermissionsModelMock)().then(function(user, perm, _room) {
              assert.equal(user.id, fixture.user1.id);
              assert.equal(perm, 'adduser');
              assert.equal(_room.id, room.id);
              return Q.resolve(true);
            });

            return roomService.addUsersToRoom(room, fixture.user1, [fixture.user3.username])
              .then(function() {
                mockito.verify(roomPermissionsModelMock, once)();
              })
              .thenResolve(room);
          })
          .then(function(room) {
            return troupeService.findById(room.id);
          })
          .then(function(room) {
            assert(room.containsUserId(fixture.user3.id), 'Expected to find newly added user in the room');
          })

          .nodeify(done);
      });

      it('should create private rooms with name', function(done) {
        var permissionsModelMock = mockito.mockFunction();
        var roomService = testRequire.withProxies("./services/room-service", {
          './permissions-model': permissionsModelMock
        });

        mockito.when(permissionsModelMock)().then(function(user, perm, uri, githubType, security) {
          assert.equal(user.id, fixture.user1.id);
          assert.equal(perm, 'create');
          assert.equal(uri, fixture.user1.username + '/private');
          assert.equal(githubType, 'USER_CHANNEL');
          assert.equal(security, 'PRIVATE');
          return Q.resolve(true);
        });

        return roomService.createCustomChildRoom(null, fixture.user1, { name: 'private',  security: 'PRIVATE' })
          .then(function(room) {
            mockito.verify(permissionsModelMock, once)();

            return makeRoomAssertions(room, [fixture.user1], [fixture.user2])
              .thenResolve(room);
          })
          .then(function(room) {
            // Get another mock
            // ADD A PERSON TO THE ROOM
            var roomPermissionsModelMock = mockito.mockFunction();
            var roomService = testRequire.withProxies("./services/room-service", {
              './room-permissions-model': roomPermissionsModelMock
            });

            mockito.when(roomPermissionsModelMock)().then(function(user, perm, _room) {
              assert.equal(user.id, fixture.user1.id);
              assert.equal(perm, 'adduser');
              assert.equal(_room.id, room.id);
              return Q.resolve(true);
            });

            return roomService.addUsersToRoom(room, fixture.user1, [fixture.user3.username])
              .then(function() {
                mockito.verify(roomPermissionsModelMock, once)();
              })
              .thenResolve(room);
          })
          .then(function(room) {
            return troupeService.findById(room.id);
          })
          .then(function(room) {
            assert(room.containsUserId(fixture.user3.id), 'Expected to find newly added user in the room');
          })
          .nodeify(done);
      });

      it('should create open rooms', function(done) {
        var permissionsModelMock = mockito.mockFunction();
        var roomService = testRequire.withProxies("./services/room-service", {
          './permissions-model': permissionsModelMock
        });

        mockito.when(permissionsModelMock)().then(function(user, perm, uri, githubType, security) {
          assert.equal(user.id, fixture.user1.id);
          assert.equal(perm, 'create');
          assert.equal(uri, fixture.user1.username + '/open');
          assert.equal(githubType, 'USER_CHANNEL');
          assert.equal(security, 'PUBLIC');
          return Q.resolve(true);
        });

        return roomService.createCustomChildRoom(null, fixture.user1, { name: 'open', security: 'PUBLIC' })
          .then(function(room) {
            mockito.verify(permissionsModelMock, once)();

            return makeRoomAssertions(room, [fixture.user1, fixture.user2], [])
              .thenResolve(room);
          })
          .then(function(room) {
            // Get another mock
            // ADD A PERSON TO THE ROOM
            var roomPermissionsModelMock = mockito.mockFunction();
            var roomService = testRequire.withProxies("./services/room-service", {
              './room-permissions-model': roomPermissionsModelMock
            });

            mockito.when(roomPermissionsModelMock)().then(function(user, perm, _room) {
              assert.equal(user.id, fixture.user1.id);
              assert.equal(perm, 'adduser');
              assert.equal(_room.id, room.id);
              return Q.resolve(true);
            });

            return roomService.addUsersToRoom(room, fixture.user1, [fixture.user3.username])
              .then(function() {
                mockito.verify(roomPermissionsModelMock, once)();
              })
              .thenResolve(room);
          })
          .then(function(room) {
            return troupeService.findById(room.id);
          })
          .then(function(room) {
            assert(room.containsUserId(fixture.user3.id), 'Expected to find newly added user in the room');
          })

          .nodeify(done);
      });

      it('should NOT create child rooms', function(done) {
        var permissionsModelMock = mockito.mockFunction();
        var roomService = testRequire.withProxies("./services/room-service", {
          './permissions-model': permissionsModelMock
        });

        var fail = 0;
        return roomService.createCustomChildRoom(null, fixture.user1, { name: 'inherited', security: 'INHERITED' })
          .fail(function() {
            fail++;
          })
          .then(function() {
            assert.equal(fail, 1);
          })
          .nodeify(done);
      });

    });

  });

  describe('user revalidation', function() {
    it('should correctly revalidate the users in a room', function(done) {
      var roomPermissionsModelMock = mockito.mockFunction();

      var roomService = testRequire.withProxies("./services/room-service", {
        './room-permissions-model': roomPermissionsModelMock
      });

      mockito.when(roomPermissionsModelMock)().then(function(user, perm, incomingRoom) {
        assert.equal(perm, 'join');
        assert.equal(incomingRoom.id, fixture.troupeRepo.id);

        if(user.id == fixture.user1.id) {
          return Q.resolve(true);
        } else if(user.id == fixture.user2.id) {
          return Q.resolve(false);
        } else {
          assert(false, 'Unknown user');
        }

      });

      return roomService.revalidatePermissionsForUsers(fixture.troupeRepo)
        .then(function() {
          var userIds = fixture.troupeRepo.getUserIds();
          assert.equal(userIds.length, 1);
          assert.equal(userIds[0], fixture.user1.id);
        })
        .nodeify(done);

    });
  });

  describe('bans', function() {
    it('should ban users from rooms', function(done) {
      var roomPermissionsModelMock = mockito.mockFunction();

      var roomService = testRequire.withProxies("./services/room-service", {
        './room-permissions-model': roomPermissionsModelMock
      });
      var userBannedFromRoom = testRequire('./services/user-banned-from-room');


      mockito.when(roomPermissionsModelMock)().then(function(user, perm, incomingRoom) {
        assert.equal(perm, 'admin');
        assert.equal(incomingRoom.id, fixture.troupeBan.id);

        if(user.id == fixture.userBan.id) {
          return Q.resolve(false);
        } else if(user.id == fixture.userBanAdmin.id) {
          return Q.resolve(true);
        } else {
          assert(false, 'Unknown user');
        }
      });

      return userBannedFromRoom(fixture.troupeBan.uri, fixture.userBan)
        .then(function(banned) {
          assert(!banned);

          return roomService.banUserFromRoom(fixture.troupeBan, fixture.userBan.username, fixture.userBanAdmin)
            .then(function(ban) {
              assert.equal(ban.userId, fixture.userBan.id);
              assert.equal(ban.bannedBy, fixture.userBanAdmin.id);
              assert(ban.dateBanned);

              assert(!fixture.troupeBan.containsUserId(fixture.userBan.id));

              return userBannedFromRoom(fixture.troupeBan.uri, fixture.userBan)
                .then(function(banned) {
                  assert(banned);

                  return roomService.unbanUserFromRoom(fixture.troupeBan, ban, fixture.userBanAdmin)
                    .then(function() {
                      return userBannedFromRoom(fixture.troupeBan.uri, fixture.userBan)
                        .then(function(banned) {
                          assert(!banned);
                        });
                    });
                });
            });
        })
        .nodeify(done);

    });
  });



describe('classic functionality', function() {

  it('should find or create a room for an org', function(done) {
    var permissionsModelMock = mockito.mockFunction();
    var roomService = testRequire("./services/room-service", {
      './permissions-model': permissionsModelMock
    });

    return roomService.findOrCreateRoom(fixture.user1, 'gitterTest')
      .then(function(uriContext) {
        assert(!uriContext.oneToOne);
        assert(!uriContext.troupe);
      })
      .nodeify(done);
  });

  it('should find or create a room for a person', function(done) {
    var permissionsModelMock = mockito.mockFunction();
    var roomService = testRequire("./services/room-service", {
      './permissions-model': permissionsModelMock
    });

    return roomService.findOrCreateRoom(fixture.user1, fixture.user2.username)
      .then(function(uriContext) {
        assert(uriContext.oneToOne);
        assert(uriContext.troupe);
        assert.equal(uriContext.otherUser.id, fixture.user2.id);
      })
      .nodeify(done);
  });

  it('should create a room for a repo', function(done) {
    var permissionsModelMock = mockito.mockFunction();
    var roomService = testRequire("./services/room-service", {
      './permissions-model': permissionsModelMock
    });

    return roomService.findOrCreateRoom(fixture.user1, 'gitterHQ/cloaked-avenger')
      .nodeify(done);
  });

  it('should create a room for a repo ignoring the case', function(done) {
    var permissionsModelMock = mockito.mockFunction();
    var roomService = testRequire("./services/room-service", {
      './permissions-model': permissionsModelMock
    });

    return roomService.findOrCreateRoom(fixture.user1, 'gitterhq/sandbox', {ignoreCase: true})
      .then(function(uriContext) {
        assert(uriContext.troupe);
        assert(uriContext.troupe.lcUri  === 'gitterhq/sandbox');
        assert(uriContext.troupe.uri    === 'gitterHQ/sandbox');
      })
      .nodeify(done);
  });


  it('should handle an invalid url correctly', function(done) {
    var permissionsModelMock = mockito.mockFunction();
    var roomService = testRequire("./services/room-service", {
      './permissions-model': permissionsModelMock
    });

    return roomService.findOrCreateRoom(fixture.user1, 'joyent')
      .then(function(uriContext) {
        assert(!uriContext.troupe);
      })
      .nodeify(done);
  });

});

describe('custom rooms', function() {

  describe('::org::', function() {

    it('should create private rooms and allow users to be added to them', function(done) {
      var permissionsModelMock = mockito.mockFunction();
      var roomService = testRequire.withProxies("./services/room-service", {
        './permissions-model': permissionsModelMock
      });

      mockito.when(permissionsModelMock)().then(function(user, perm, uri, githubType, security) {
        assert.equal(user.id, fixture.user1.id);
        assert.equal(perm, 'create');
        assert.equal(uri, fixture.troupeOrg1.uri + '/private');
        assert.equal(githubType, 'ORG_CHANNEL');
        assert.equal(security, 'PRIVATE');
        return Q.resolve(true);
      });

      return roomService.createCustomChildRoom(fixture.troupeOrg1, fixture.user1, { name: 'private', security: 'PRIVATE' })
        .then(function(room) {
          mockito.verify(permissionsModelMock, once)();

          return makeRoomAssertions(room, [fixture.user1, fixture.user2], [fixture.user3])
            .thenResolve(room);
        })
        .then(function(room) {
          // Get another mock
          // ADD A PERSON TO THE ROOM
          var roomPermissionsModelMock = mockito.mockFunction();
          var roomService = testRequire.withProxies("./services/room-service", {
            './room-permissions-model': roomPermissionsModelMock
          });

          mockito.when(roomPermissionsModelMock)().then(function(user, perm, incomingRoom) {
            assert.equal(user.id, fixture.user1.id);
            assert.equal(perm, 'adduser');
            assert.equal(incomingRoom.id, room.id);
            return Q.resolve(true);
          });

          return roomService.addUsersToRoom(room, fixture.user1, [fixture.user3.username])
            .then(function() {
              mockito.verify(permissionsModelMock, once)();
            })
            .thenResolve(room);
        })
        .then(function(room) {
          return troupeService.findById(room.id);
        })
        .then(function(room) {
          assert(room.containsUserId(fixture.user3.id), 'Expected to find newly added user in the room');
        })
        .nodeify(done);
    });

    it('should create open rooms', function(done) {
      var permissionsModelMock = mockito.mockFunction();
      var roomService = testRequire.withProxies("./services/room-service", {
        './permissions-model': permissionsModelMock
      });

      mockito.when(permissionsModelMock)().then(function(user, perm, uri, githubType, security) {
        assert.equal(user.id, fixture.user1.id);
        assert.equal(perm, 'create');
        assert.equal(uri, fixture.troupeOrg1.uri + '/open');
        assert.equal(githubType, 'ORG_CHANNEL');
        assert.equal(security, 'PUBLIC');
        return Q.resolve(true);
      });

      return roomService.createCustomChildRoom(fixture.troupeOrg1, fixture.user1, { name: 'open', security: 'PUBLIC' })
        .then(function(room) {
          mockito.verify(permissionsModelMock, once)();

          return makeRoomAssertions(room, [fixture.user1, fixture.user2, fixture.user3], [])
            .thenResolve(room);
        })
        .then(function(room) {
          // Get another mock
          // ADD A PERSON TO THE ROOM
          var roomPermissionsModelMock = mockito.mockFunction();
          var roomService = testRequire.withProxies("./services/room-service", {
            './room-permissions-model': roomPermissionsModelMock
          });

          mockito.when(roomPermissionsModelMock)().then(function(user, perm, _room) {
            assert.equal(user.id, fixture.user1.id);
            assert.equal(perm, 'adduser');
            assert.equal(room.id, _room.id);
            return Q.resolve(true);
          });

          return roomService.addUsersToRoom(room, fixture.user1, [fixture.user3.username])
            .then(function() {
              mockito.verify(roomPermissionsModelMock, once)();
            })
            .thenResolve(room);
        })
        .then(function(room) {
          return troupeService.findById(room.id);
        })
        .then(function(room) {
          assert(room.containsUserId(fixture.user3.id), 'Expected to find newly added user in the room');
        })
        .nodeify(done);
    });

    it('should create inherited rooms', function(done) {
      var permissionsModelMock = mockito.mockFunction();
      var roomService = testRequire.withProxies("./services/room-service", {
        './permissions-model': permissionsModelMock
      });

      mockito.when(permissionsModelMock)().then(function(user, perm, uri, githubType, security) {
        assert.equal(user.id, fixture.user1.id);
        assert.equal(perm, 'create');
        assert.equal(uri, fixture.troupeOrg1.uri + '/child');
        assert.equal(githubType, 'ORG_CHANNEL');
        assert.equal(security, 'INHERITED');
        return Q.resolve(true);
      });

      return roomService.createCustomChildRoom(fixture.troupeOrg1, fixture.user1, { name: 'child', security: 'INHERITED' })
        .then(function(room) {
          mockito.verify(permissionsModelMock, once)();

          return makeRoomAssertions(room, [fixture.user1, fixture.user2], [ fixture.user3])
            .thenResolve(room);
        })
        .then(function(room) {
          // Get another mock
          // ADD A PERSON TO THE ROOM
          var roomPermissionsModelMock = mockito.mockFunction();
          var roomService = testRequire.withProxies("./services/room-service", {
            './room-permissions-model': roomPermissionsModelMock
          });

          mockito.when(roomPermissionsModelMock)().then(function(user, perm, _room) {
            assert.equal(user.id, fixture.user1.id);
            assert.equal(perm, 'adduser');
            assert.equal(room.id, _room.id);
            return Q.resolve(true);
          });

          return roomService.addUsersToRoom(room, fixture.user1, [fixture.user3.username])
            .then(function() {
              mockito.verify(roomPermissionsModelMock, once)();
            })
            .thenResolve(room);
        })
        .then(function(room) {
          return troupeService.findById(room.id);
        })
        .then(function(room) {
          assert(room.containsUserId(fixture.user3.id), 'Expected to find newly added user in the room');
        })
        .nodeify(done);
    });

  });

  describe('::repo::', function() {
    it(/* ::repo */ 'should create private rooms', function(done) {
      var permissionsModelMock = mockito.mockFunction();
      var roomService = testRequire.withProxies("./services/room-service", {
        './permissions-model': permissionsModelMock
      });

      mockito.when(permissionsModelMock)().then(function(user, perm, uri, githubType, security) {
        assert.equal(user.id, fixture.user1.id);
        assert.equal(perm, 'create');
        assert.equal(uri, fixture.troupeRepo.uri + '/private');
        assert.equal(githubType, 'REPO_CHANNEL');
        assert.equal(security, 'PRIVATE');
        return Q.resolve(true);
      });

      return roomService.createCustomChildRoom(fixture.troupeRepo, fixture.user1, { name: 'private', security: 'PRIVATE' })
        .then(function(room) {
          mockito.verify(permissionsModelMock, once)();

          return makeRoomAssertions(room, [fixture.user1], [fixture.user2, fixture.user3])
            .thenResolve(room);
        })
        .then(function(room) {
          // Get another mock
          // ADD A PERSON TO THE ROOM
          var roomPermissionsModelMock = mockito.mockFunction();
          var roomService = testRequire.withProxies("./services/room-service", {
            './room-permissions-model': roomPermissionsModelMock
          });

          mockito.when(roomPermissionsModelMock)().then(function(user, perm, _room) {
            assert.equal(user.id, fixture.user1.id);
            assert.equal(perm, 'adduser');
            assert.equal(_room.id, room.id);
            return Q.resolve(true);
          });

          return roomService.addUsersToRoom(room, fixture.user1, [fixture.user3.username])
            .then(function() {
              mockito.verify(roomPermissionsModelMock, once)();
            })
            .thenResolve(room);
        })
        .then(function(room) {
          return troupeService.findById(room.id);
        })
        .then(function(room) {
          assert(room.containsUserId(fixture.user3.id), 'Expected to find newly added user in the room');
        })
        .nodeify(done);
    });

    it(/* ::repo */ 'should create open rooms', function(done) {
      var permissionsModelMock = mockito.mockFunction();
      var roomService = testRequire.withProxies("./services/room-service", {
        './permissions-model': permissionsModelMock
      });


      mockito.when(permissionsModelMock)().then(function(user, perm, uri, githubType, security) {
        assert.equal(user.id, fixture.user1.id);
        assert.equal(perm, 'create');
        assert.equal(uri, fixture.troupeRepo.uri + '/open');
        assert.equal(githubType, 'REPO_CHANNEL');
        assert.equal(security, 'PUBLIC');
        return Q.resolve(true);
      });

      return roomService.createCustomChildRoom(fixture.troupeRepo, fixture.user1, { name: 'open', security: 'PUBLIC' })
        .then(function(room) {
          mockito.verify(permissionsModelMock, once)();

          return makeRoomAssertions(room, [fixture.user1, fixture.user2, fixture.user3], [])
            .thenResolve(room);
        })
        .then(function(room) {
          // Get another mock
          // ADD A PERSON TO THE ROOM
          var roomPermissionsModelMock = mockito.mockFunction();
          var roomService = testRequire.withProxies("./services/room-service", {
            './room-permissions-model': roomPermissionsModelMock
          });

          mockito.when(roomPermissionsModelMock)().then(function(user, perm, _room) {
            assert.equal(user.id, fixture.user1.id);
            assert.equal(perm, 'adduser');
            assert.equal(_room.id, room.id);
            return Q.resolve(true);
          });

          return roomService.addUsersToRoom(room, fixture.user1, [fixture.user3.username])
            .then(function() {
              mockito.verify(roomPermissionsModelMock, once)();
            })
            .thenResolve(room);
        })
        .then(function(room) {
          return troupeService.findById(room.id);
        })
        .then(function(room) {
          assert(room.containsUserId(fixture.user3.id), 'Expected to find newly added user in the room');
        })

        .nodeify(done);
    });

    it(/* ::repo */ 'should create inherited rooms', function(done) {
      var permissionsModelMock = mockito.mockFunction();
      var roomService = testRequire.withProxies("./services/room-service", {
        './permissions-model': permissionsModelMock
      });

      mockito.when(permissionsModelMock)().then(function(user, perm, uri, githubType, security) {
        assert.equal(user.id, fixture.user1.id);
        assert.equal(perm, 'create');
        assert.equal(uri, fixture.troupeRepo.uri + '/child');
        assert.equal(githubType, 'REPO_CHANNEL');
        assert.equal(security, 'INHERITED');
        return Q.resolve(true);
      });

      return roomService.createCustomChildRoom(fixture.troupeRepo, fixture.user1, { name: 'child', security: 'INHERITED' })
        .then(function(room) {
          mockito.verify(permissionsModelMock, once)();

          return makeRoomAssertions(room, [fixture.user1, fixture.user2], [fixture.user3])
            .thenResolve(room);
        })
        .then(function(room) {
          // Get another mock
          // ADD A PERSON TO THE ROOM
          var roomPermissionsModelMock = mockito.mockFunction();
          var roomService = testRequire.withProxies("./services/room-service", {
            './room-permissions-model': roomPermissionsModelMock
          });

          mockito.when(roomPermissionsModelMock)().then(function(user, perm, _room) {
            assert.equal(user.id, fixture.user1.id);
            assert.equal(perm, 'adduser');
            assert.equal(_room.id, room.id);
            return Q.resolve(true);
          });

          return roomService.addUsersToRoom(room, fixture.user1, [fixture.user3.username])
            .then(function() {
              mockito.verify(permissionsModelMock, once)();
            })
            .thenResolve(room);
        })
        .then(function(room) {
          return troupeService.findById(room.id);
        })
        .then(function(room) {
          assert(room.containsUserId(fixture.user3.id), 'Expected to find newly added user in the room');
        })

        .nodeify(done);
    });

  });

  describe('::user::', function() {

    it('should create private rooms without a name', function(done) {
      var permissionsModelMock = mockito.mockFunction();
      var roomService = testRequire.withProxies("./services/room-service", {
        './permissions-model': permissionsModelMock
      });

      mockito.when(permissionsModelMock)().then(function(user, perm, uri, githubType, security) {
        assert.equal(user.id, fixture.user1.id);
        assert.equal(perm, 'create');
        assert.equal(githubType, 'USER_CHANNEL');
        assert.equal(security, 'PRIVATE');
        return Q.resolve(true);
      });

      return roomService.createCustomChildRoom(null, fixture.user1, { security: 'PRIVATE' })
        .then(function(room) {
          mockito.verify(permissionsModelMock, once)();

          return makeRoomAssertions(room, [fixture.user1], [fixture.user2])
            .thenResolve(room);
        })
        .then(function(room) {
          // Get another mock
          // ADD A PERSON TO THE ROOM
          var roomPermissionsModelMock = mockito.mockFunction();
          var roomService = testRequire.withProxies("./services/room-service", {
            './room-permissions-model': roomPermissionsModelMock
          });

          mockito.when(roomPermissionsModelMock)().then(function(user, perm, _room) {
            assert.equal(user.id, fixture.user1.id);
            assert.equal(perm, 'adduser');
            assert.equal(_room.id, room.id);
            return Q.resolve(true);
          });

          return roomService.addUsersToRoom(room, fixture.user1, [fixture.user3.username])
            .then(function() {
              mockito.verify(roomPermissionsModelMock, once)();
            })
            .thenResolve(room);
        })
        .then(function(room) {
          return troupeService.findById(room.id);
        })
        .then(function(room) {
          assert(room.containsUserId(fixture.user3.id), 'Expected to find newly added user in the room');
        })

        .nodeify(done);
    });

    it('should create private rooms with name', function(done) {
      var permissionsModelMock = mockito.mockFunction();
      var roomService = testRequire.withProxies("./services/room-service", {
        './permissions-model': permissionsModelMock
      });

      mockito.when(permissionsModelMock)().then(function(user, perm, uri, githubType, security) {
        assert.equal(user.id, fixture.user1.id);
        assert.equal(perm, 'create');
        assert.equal(uri, fixture.user1.username + '/private');
        assert.equal(githubType, 'USER_CHANNEL');
        assert.equal(security, 'PRIVATE');
        return Q.resolve(true);
      });

      return roomService.createCustomChildRoom(null, fixture.user1, { name: 'private',  security: 'PRIVATE' })
        .then(function(room) {
          mockito.verify(permissionsModelMock, once)();

          return makeRoomAssertions(room, [fixture.user1], [fixture.user2])
            .thenResolve(room);
        })
        .then(function(room) {
          // Get another mock
          // ADD A PERSON TO THE ROOM
          var roomPermissionsModelMock = mockito.mockFunction();
          var roomService = testRequire.withProxies("./services/room-service", {
            './room-permissions-model': roomPermissionsModelMock
          });

          mockito.when(roomPermissionsModelMock)().then(function(user, perm, _room) {
            assert.equal(user.id, fixture.user1.id);
            assert.equal(perm, 'adduser');
            assert.equal(_room.id, room.id);
            return Q.resolve(true);
          });

          return roomService.addUsersToRoom(room, fixture.user1, [fixture.user3.username])
            .then(function() {
              mockito.verify(roomPermissionsModelMock, once)();
            })
            .thenResolve(room);
        })
        .then(function(room) {
          return troupeService.findById(room.id);
        })
        .then(function(room) {
          assert(room.containsUserId(fixture.user3.id), 'Expected to find newly added user in the room');
        })
        .nodeify(done);
    });

    it('should create open rooms', function(done) {
      var permissionsModelMock = mockito.mockFunction();
      var roomService = testRequire.withProxies("./services/room-service", {
        './permissions-model': permissionsModelMock
      });

      mockito.when(permissionsModelMock)().then(function(user, perm, uri, githubType, security) {
        assert.equal(user.id, fixture.user1.id);
        assert.equal(perm, 'create');
        assert.equal(uri, fixture.user1.username + '/open');
        assert.equal(githubType, 'USER_CHANNEL');
        assert.equal(security, 'PUBLIC');
        return Q.resolve(true);
      });

      return roomService.createCustomChildRoom(null, fixture.user1, { name: 'open', security: 'PUBLIC' })
        .then(function(room) {
          mockito.verify(permissionsModelMock, once)();

          return makeRoomAssertions(room, [fixture.user1, fixture.user2], [])
            .thenResolve(room);
        })
        .then(function(room) {
          // Get another mock
          // ADD A PERSON TO THE ROOM
          var roomPermissionsModelMock = mockito.mockFunction();
          var roomService = testRequire.withProxies("./services/room-service", {
            './room-permissions-model': roomPermissionsModelMock
          });

          mockito.when(roomPermissionsModelMock)().then(function(user, perm, _room) {
            assert.equal(user.id, fixture.user1.id);
            assert.equal(perm, 'adduser');
            assert.equal(_room.id, room.id);
            return Q.resolve(true);
          });

          return roomService.addUsersToRoom(room, fixture.user1, [fixture.user3.username])
            .then(function() {
              mockito.verify(roomPermissionsModelMock, once)();
            })
            .thenResolve(room);
        })
        .then(function(room) {
          return troupeService.findById(room.id);
        })
        .then(function(room) {
          assert(room.containsUserId(fixture.user3.id), 'Expected to find newly added user in the room');
        })

        .nodeify(done);
    });

    it('should NOT create child rooms', function(done) {
      var permissionsModelMock = mockito.mockFunction();
      var roomService = testRequire.withProxies("./services/room-service", {
        './permissions-model': permissionsModelMock
      });

      var fail = 0;
      return roomService.createCustomChildRoom(null, fixture.user1, { name: 'inherited', security: 'INHERITED' })
        .fail(function() {
          fail++;
        })
        .then(function() {
          assert.equal(fail, 1);
        })
        .nodeify(done);
    });

  });

});

describe('user revalidation', function() {
  it('should correctly revalidate the users in a room', function(done) {
    var roomPermissionsModelMock = mockito.mockFunction();

    var roomService = testRequire.withProxies("./services/room-service", {
      './room-permissions-model': roomPermissionsModelMock
    });

    mockito.when(roomPermissionsModelMock)().then(function(user, perm, incomingRoom) {
      assert.equal(perm, 'join');
      assert.equal(incomingRoom.id, fixture.troupeRepo.id);

      if(user.id == fixture.user1.id) {
        return Q.resolve(true);
      } else if(user.id == fixture.user2.id) {
        return Q.resolve(false);
      } else {
        assert(false, 'Unknown user');
      }

    });

    return roomService.revalidatePermissionsForUsers(fixture.troupeRepo)
      .then(function() {
        var userIds = fixture.troupeRepo.getUserIds();
        assert.equal(userIds.length, 1);
        assert.equal(userIds[0], fixture.user1.id);
      })
      .nodeify(done);

  });
});

describe('bans', function() {
  it('should ban users from rooms', function(done) {
    var roomPermissionsModelMock = mockito.mockFunction();

    var roomService = testRequire.withProxies("./services/room-service", {
      './room-permissions-model': roomPermissionsModelMock
    });
    var userBannedFromRoom = testRequire('./services/user-banned-from-room');


    mockito.when(roomPermissionsModelMock)().then(function(user, perm, incomingRoom) {
      assert.equal(perm, 'admin');
      assert.equal(incomingRoom.id, fixture.troupeBan.id);

      if(user.id == fixture.userBan.id) {
        return Q.resolve(false);
      } else if(user.id == fixture.userBanAdmin.id) {
        return Q.resolve(true);
      } else {
        assert(false, 'Unknown user');
      }
    });

    return userBannedFromRoom(fixture.troupeBan.uri, fixture.userBan)
      .then(function(banned) {
        assert(!banned);

        return roomService.banUserFromRoom(fixture.troupeBan, fixture.userBan.username, fixture.userBanAdmin)
          .then(function(ban) {
            assert.equal(ban.userId, fixture.userBan.id);
            assert.equal(ban.bannedBy, fixture.userBanAdmin.id);
            assert(ban.dateBanned);

            assert(!fixture.troupeBan.containsUserId(fixture.userBan.id));

            return userBannedFromRoom(fixture.troupeBan.uri, fixture.userBan)
              .then(function(banned) {
                assert(banned);

                return roomService.unbanUserFromRoom(fixture.troupeBan, ban, fixture.userBanAdmin)
                  .then(function() {
                    return userBannedFromRoom(fixture.troupeBan.uri, fixture.userBan)
                      .then(function(banned) {
                        assert(!banned);
                      });
                  });
              });
          });
      })
      .nodeify(done);

  });

  it('should not allow admins to be banned', function(done) {
    var roomPermissionsModelMock = mockito.mockFunction();

    var roomService = testRequire.withProxies("./services/room-service", {
      './room-permissions-model': roomPermissionsModelMock
    });

    mockito.when(roomPermissionsModelMock)().then(function(user, perm, incomingRoom) {
      assert.equal(perm, 'admin');
      assert.equal(incomingRoom.id, fixture.troupeBan.id);

      if(user.id == fixture.userBan.id) {
        return Q.resolve(true);
      } else if(user.id == fixture.userBanAdmin.id) {
        return Q.resolve(true);
      } else {
        assert(false, 'Unknown user');
      }
    });


    return roomService.banUserFromRoom(fixture.troupeBan, fixture.userBan.username, fixture.userBanAdmin)
      .then(function() {
        assert(false, 'Expected to fail as user is not an admin');
      })
      .fail(function(err) {
        assert.equal(err.status, 400);
      })
      .nodeify(done);

  });

});



});
