/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var redis = require("../utils/redis");
var nconf = require("../utils/config");
var winston = require('../utils/winston');
var events = require('events');
var assert = require('assert');
var Fiber = require('../utils/fiber');
var appEvents = require('../app-events.js');
var Q = require('q');
var _ = require("underscore");

var presenceService = new events.EventEmitter();

var redisClient = redis.createClient();

var Scripto = require('redis-scripto');
var scriptManager = new Scripto(redisClient);
scriptManager.loadFromDir(__dirname + '/../../redis-lua/presence');

var prefix = nconf.get('presence:prefix') + ':';

var ACTIVE_USERS_KEY = prefix + 'active_u';
var MOBILE_USERS_KEY = prefix + 'mobile_u';

var ACTIVE_SOCKETS_KEY = prefix + 'activesockets';


function keyUserLock(userId) {
  return prefix + "ul:" + userId;
}

function keySocketUser(socketId) {
  return prefix + "sh:" + socketId;
}

function keyTroupeUsers(troupeId) {
  return prefix + "tu:" + troupeId;
}

function keyUserSockets(troupeId) {
  return prefix + "us:" + troupeId;
}


// Callback(err);
function disassociateSocketAndDeactivateUserAndTroupe(socketId, userId, callback) {
  assert(userId, 'userId expected');
  assert(socketId, 'socketId expected');

  lookupTroupeIdForSocket(socketId, function(err, troupeId) {
    if(err) return callback(err);

    var keys = [keySocketUser(socketId), ACTIVE_USERS_KEY, MOBILE_USERS_KEY, ACTIVE_SOCKETS_KEY, keyUserLock(userId), troupeId ? keyTroupeUsers(troupeId) : null, keyUserSockets(userId)];
    var values = [userId, socketId];

    scriptManager.run('presence-disassociate', keys, values, function(err, result) {
      if(err) return callback(err);

      var deleteSuccess = result[0];
      if(!deleteSuccess) {
        winston.silly('presence: disassociateSocketAndDeactivateUserAndTroupe rejected. Socket already deleted.', {
          socketId: socketId,
          userId: userId
        });

        return callback(404);
      }

      var userSocketCount = parseInt(result[1], 10);
      var sremResult = result[2];

      var userInTroupeCount = parseInt(result[3], 10);  // If the user was already eboff, this will be -1
      var totalUsersInTroupe = result[4];               // If the user was already eboff, this will be -1

      if(sremResult != 1) {
        winston.warn("presence: Socket has already been removed from active sockets. Something fishy is happening.");
      }

      if(userSocketCount === 0) {
        presenceService.emit('userOffline', userId);
      }

      sendAppEventsForUserEyeballsOffTroupe(userInTroupeCount, totalUsersInTroupe, userId, troupeId, socketId);
      return callback();
    });
  });


}

function sendAppEventsForUserEyeballsOffTroupe(userInTroupeCount, totalUsersInTroupe, userId, troupeId, socketId) {
  if(totalUsersInTroupe === 0 && userInTroupeCount > 0) {
    winston.warn("presence: Troupe is empty, yet user has not left troupe. Something is fishy.", {
      troupeId: troupeId,
      socketId: socketId,
      userId: userId,
      userInTroupeCount: userInTroupeCount,
      totalUsersInTroupe: totalUsersInTroupe
    });
  }

  /* If userInTroupeCount is -1, eyeballs were already off */
  if(userInTroupeCount === 0) {
    presenceService.emit('userLeftTroupe', userId, troupeId);
  }

  /* If totalUsersInTroupe is -1, eyeballs were already off */
  if(totalUsersInTroupe !== -1) {
    appEvents.eyeballSignal(userId, troupeId, false);
  }

  if(totalUsersInTroupe === 0) {
    presenceService.emit('troupeEmpty', troupeId);
  }
}


function userSocketConnected(userId, socketId, connectionType, client, troupeId, eyeballState, callback) {
  assert(userId, 'userId expected');
  assert(socketId, 'socketId expected');

  if(!callback) callback = function() {};

  var isMobileConnection = connectionType == 'mobile';

  var keys = [keySocketUser(socketId), ACTIVE_USERS_KEY, MOBILE_USERS_KEY, ACTIVE_SOCKETS_KEY, keyUserLock(userId), keyUserSockets(userId)];
  var values = [userId, socketId, Date.now(), isMobileConnection ? 1 : 0, client, troupeId];

  scriptManager.run('presence-associate', keys, values, function(err, result) {
    if(err) return callback(err);

    var lockSuccess = result[0];

    if(!lockSuccess)  {
      winston.silly('presence: associateSocketAndActivateUser rejected. Socket already exists.', {
        socketId: socketId,
        userId: userId
      });

      return callback(409 /* conflict */);
    }

    var userSocketCount = parseInt(result[1], 10);
    var saddResult = result[2];

    if(saddResult != 1) {
      winston.warn("presence: Socket has already been added to active sockets. Something fishy is happening.");
    }

    if(userSocketCount === 1) {
      presenceService.emit('userOnline', userId);
    }

    if(troupeId && eyeballState) {
      eyeBallsOnTroupe(userId, socketId, troupeId, function(err) {
        if(err) {
          winston.error('Unable to signal eyeballs on: ' + err, {
            userId: userId,
            socketId: socketId,
            exception: err
          });
        }

        // Ignore the error
        return callback(null, userSocketCount);
      });
    } else {
      return callback(null, userSocketCount);
    }

  });

}

function socketDisconnectionRequested(userId, socketId, callback) {
  assert(socketId, 'socketId expected');
  assert(userId, 'userId expected');

  lookupUserIdForSocket(socketId, function(err, userId2) {
    if(err) return callback(err);
    if(userId !== userId2) {
      return callback(401);
    }

    disassociateSocketAndDeactivateUserAndTroupe(socketId, userId, callback);

  });
}

function socketDisconnected(socketId, callback) {
  assert(socketId, 'socketId expected');

  lookupUserIdForSocket(socketId, function(err, userId) {
    if(err) return callback(err);
    if(!userId) {
      return callback(404);
    }

    disassociateSocketAndDeactivateUserAndTroupe(socketId, userId, callback);

  });
}

function socketGarbageCollected(socketId, callback) {
  socketDisconnected(socketId, function(err) {
    if(err) {
      // Force socket disconnect
      // Technically this should never happen now that sockets are associated at authentication
      // time and therefore we never have a socket and userId at the same time
      winston.error('Unable to disconnect socket, forcing disconnect: ' + err, { socketId: socketId });

      var keys = [keySocketUser(socketId), ACTIVE_SOCKETS_KEY];
      var values = [socketId];

      scriptManager.run('presence-force-disassociate', keys, values, callback);
      return;
    }

    callback();
  });
}

function eyeBallsOnTroupe(userId, socketId, troupeId, callback) {
  assert(userId, 'userId expected');
  assert(socketId, 'socketId expected');
  assert(troupeId, 'troupeId expected');

  var keys = [keySocketUser(socketId), keyTroupeUsers(troupeId), keyUserLock(userId)];
  var values = [userId];

  scriptManager.run('presence-eyeballs-on', keys, values, function(err, result) {
    if(err) return callback(err);
    var eyeballLock = result[0];

    if(!eyeballLock) {
      // Eyeballs is already on, silently ignore
      return callback();
    }

    var userScore = parseInt(result[1], 10);                   // Score for user is returned as a string
    if(userScore == 1) {
      presenceService.emit('userJoinedTroupe', userId, troupeId);
    }

    appEvents.eyeballSignal(userId, troupeId, true);

    return callback();

  });

}

function eyeBallsOffTroupe(userId, socketId, troupeId, callback) {
  assert(userId, 'userId expected');
  assert(socketId, 'socketId expected');
  assert(troupeId, 'troupeId expected');

  var keys = [keySocketUser(socketId), keyTroupeUsers(troupeId), keyUserLock(userId)];
  var values = [userId];

  scriptManager.run('presence-eyeballs-off', keys, values, function(err, result) {
    if(err) return callback(err);

    var eyeballLock = result[0];

    if(!eyeballLock) {
      // Eyeballs is already off, silently ignore
      return callback();
    }

    var userInTroupeCount = parseInt(result[1], 10);
    var totalUsersInTroupe = result[2];

    sendAppEventsForUserEyeballsOffTroupe(userInTroupeCount, totalUsersInTroupe, userId, troupeId, socketId);

    return callback();

  });

}

// Callback -> (err, { userId: X, troupeId: Y })
function lookupSocketOwnerAndTroupe(socketId, callback) {
  redisClient.hmget(keySocketUser(socketId), "uid", "tid", function(err, result) {
    if(err) return callback(err);

    callback(null, {
      userId: result[0],
      troupeId: result[1]
    });
  });
}

function lookupUserIdForSocket (socketId, callback) {
  assert(socketId, 'socketId expected');

  redisClient.hget(keySocketUser(socketId), "uid", callback);
}

function lookupTroupeIdForSocket (socketId, callback) {
  assert(socketId, 'socketId expected');

  redisClient.hget(keySocketUser(socketId), "tid", callback);
}


function findOnlineUsersForTroupe(troupeId, callback) {
  assert(troupeId, 'troupeId expected');

  redisClient.zrangebyscore(keyTroupeUsers(troupeId), 1, '+inf', callback);
}

// Given an array of usersIds, returns a hash with the status of each user. If the user is no in the hash
// it implies that they're offline
// callback(err, status)
// with status[userId] = 'online' / <missing>
function categorizeUsersByOnlineStatus(userIds, callback) {
  if(!userIds || userIds.length === 0) return callback(null, {});

  var t = process.hrtime();
  var key = prefix + "presence_temp_set:" + process.pid + ":" + t[0] + ":" + t[1];
  var out_key = prefix + "presence_temp_set:" + process.pid + ":" + t[0] + ":" + t[1] + '_out';

  var keys = [key, out_key, ACTIVE_USERS_KEY];
  var values = userIds;

  var d = Q.defer();

  scriptManager.run('presence-categorize-users', keys, values, function(err, onlineUsers) {
    if(err) return d.reject(err);

    var result = {};
    if(onlineUsers) onlineUsers.forEach(function(userId) {
      result[userId] = 'online';
    });
    return d.resolve(result);
  });

  return d.promise.nodeify(callback);
}

function categorizeUserTroupesByOnlineStatus(userTroupes, callback) {
  var f = new Fiber();

  var troupeIds = _.uniq(userTroupes.map(function(userTroupe) { return userTroupe.troupeId; }));
  var userIds = _.uniq(userTroupes.map(function(userTroupe) { return userTroupe.userId; }));

  listOnlineUsersForTroupes(troupeIds, f.waitor());
  categorizeUsersByOnlineStatus(userIds, f.waitor());

  f.all().spread(function(troupeOnlineUsers, statii) {
    var inTroupe = [];
    var online = [];
    var offline = [];

    userTroupes.forEach(function(userTroupe) {
      var userId = userTroupe.userId;
      var troupeId = userTroupe.troupeId;

      var onlineForTroupe = troupeOnlineUsers[troupeId];
      if(onlineForTroupe.indexOf(userId) >= 0) {
        inTroupe.push(userTroupe);
      } else if(statii[userId] == 'online') {
        online.push(userTroupe);
      } else {
        offline.push(userTroupe);
      }
    });

    callback(null, {
      inTroupe: inTroupe,
      online: online,
      offline: offline
    });

  }, callback);
}

function findAllSocketsForUserInTroupe(userId, troupeId, callback) {
  listAllSocketsForUser(userId, function(err, socketIds) {
    if(err) return callback(err);
    if(!socketIds || !socketIds.length) return callback(null, []);

    var multi = redisClient.multi();
    socketIds.forEach(function(socketId) {
      multi.hmget(keySocketUser(socketId), 'tid');
    });

    multi.exec(function(err, replies) {
      if(err) return callback(err);
      var result = replies.reduce(function(memo, hash, index) {
          var tId = hash[0];
          if(tId === troupeId) {
            memo.push(socketIds[index]);
          }

          return memo;
        }, []);

      return callback(null, result);
    });

  });

}

function isUserConnectedWithClientType(userId, clientType, callback) {
  listAllSocketsForUser(userId, function(err, socketIds) {
    if(err) return callback(err);
    if(!socketIds || !socketIds.length) return callback(null, false);

    var multi = redisClient.multi();
    socketIds.forEach(function(socketId) {
      multi.hmget(keySocketUser(socketId), 'ct');
    });

    multi.exec(function(err, replies) {
      if(err) return callback(err);

      var clientTypeBeta = clientType + 'beta';

      for(var i = 0; i < replies.length; i++) {
        var ct = replies[i][0];
        if(ct === clientType || ct === clientTypeBeta) return callback(null, true);
      }

      return callback(null, false);
    });

  });
}

function listAllSocketsForUser(userId, callback) {
  redisClient.smembers(keyUserSockets(userId), callback);
}

function listOnlineUsers(callback) {
  redisClient.zrange(ACTIVE_USERS_KEY, 0, -1, callback);
}

function listMobileUsers(callback) {
  redisClient.zrange(MOBILE_USERS_KEY, 0, -1, callback);
}

function listActiveSockets(callback) {
  // This can't be done in a lua script as we don't know the keys in advance
  redisClient.smembers(ACTIVE_SOCKETS_KEY, function(err, socketIds) {
    if(err) return callback(err);
    if(socketIds.length === 0) return callback(err, []);

    var multi = redisClient.multi();
    socketIds.forEach(function(socketId) {
      multi.hmget(keySocketUser(socketId), 'uid', 'tid', 'eb', 'mob', 'ctime', 'ct');
    });

    multi.exec(function(err, replies) {
      if(err) return callback(err);

      var result = replies.map(function(reply, index) {
        return {
          id: socketIds[index],
          userId: reply[0],
          troupeId: reply[1],
          eyeballs: !!reply[2],
          mobile: !!reply[3],
          createdTime: parseInt(reply[4], 10),
          client: reply[5]
        };
      });

      return callback(null, result);
    });
  });
}

// Returns the online users for the given troupes
// The callback function returns a hash
// result[troupeId] = [userIds]
function listOnlineUsersForTroupes(troupeIds, callback) {
  if(!troupeIds || troupeIds.length === 0) return callback(null, {});

  troupeIds = _.uniq(troupeIds);

  var multi = redisClient.multi();

  troupeIds.forEach(function(troupeId) {
    multi.zrangebyscore(keyTroupeUsers(troupeId), 1, '+inf');
  });

  multi.exec(function(err, replies) {
    if(err) return callback(err);

    var result = {};
    troupeIds.forEach(function(troupeId, index) {
      var onlineUsers = replies[index];

      result[troupeId] = onlineUsers;
    });

    return callback(null, result);
  });

}

function clientEyeballSignal(userId, socketId, eyeballsOn, callback) {
  assert(userId, 'userId expected');
  assert(socketId, 'socketId expected');

  lookupSocketOwnerAndTroupe(socketId, function(err, socketInfo) {
    if(err) return callback(err);
    if(!socketInfo) {
      winston.warn("User " + userId + " attempted to eyeball missing socket " + socketId);
      return callback({ invalidSocketId: true });
    }

    var userId2 = socketInfo.userId;
    if(userId !== userId2) {
      winston.warn("User " + userId + " attempted to eyeball socket " + socketId + " but that socket belongs to " + userId2);
      return callback({ invalidSocketId: true });
    }

    var troupeId = socketInfo.troupeId;
    if(!troupeId) return callback('Socket is not associated with a troupe');

    if(eyeballsOn) {
      winston.verbose('presence: Eyeballs on: user ' + userId + ' troupe ' + troupeId);
      return eyeBallsOnTroupe(userId, socketId, troupeId, callback);

    } else {
      winston.verbose('presence: Eyeballs off: user ' + userId + ' troupe ' + troupeId);
      return eyeBallsOffTroupe(userId, socketId, troupeId, callback);
    }
  });

}


function collectGarbage(engine, callback) {
  var start = Date.now();

  validateActiveSockets(engine, function(err, invalidSocketCount) {
    if(err) {
      winston.error('Error while validating active sockets: ' + err, { exception: err });
      return callback(err);
    }

    var total = Date.now() - start;
    var message = 'Presence GC took ' + total + 'ms and cleared out ' + invalidSocketCount + ' sockets';

    if(invalidSocketCount) {
      winston.warn(message);
    } else {
      winston.silly(message);
    }

    return callback(null, invalidSocketCount);
  });

}


function startPresenceGcService(engine) {
  var i = 0;
  setInterval(function() {
    collectGarbage(engine, function(err) {
      if(err) return;

      if(++i % 10 === 0) {
        winston.verbose('Performing user validation');
        validateUsers(function(err) {
          winston.verbose('User validation complete');

          if(err) return;
        });
      }
    });
  }, nconf.get('presence:gcInterval'));
}


function validateActiveSockets(engine, callback) {
  redisClient.smembers(ACTIVE_SOCKETS_KEY, function(err, sockets) {
    if(!sockets.length) {
      winston.verbose('presence: Validation: No active sockets.');
      return callback(null, 0);
    }

    var invalidCount = 0;

    winston.verbose('presence: Validating ' + sockets.length + ' active sockets');
    var promises = [];

    sockets.forEach(function(socketId) {
      var d = Q.defer();
      promises.push(d.promise);

      engine.clientExists(socketId, function(exists) {
        if(exists) return d.resolve(); /* All good */

        invalidCount++;
        winston.verbose('Disconnecting invalid socket ' + socketId);

        socketGarbageCollected(socketId, function(err) {
          if(err) {
            winston.info('Failure while gc-ing invalid socket', { exception: err, socketId: socketId });
          }

          d.resolve();
        });
      });

    });

    Q.all(promises).then(function() { callback(null, invalidCount); }, callback);
  });
}

function hashZset(scoresArray) {
  var hash = {};
  for(var i = 0; i < scoresArray.length; i = i + 2) {
    hash[scoresArray[i]] = parseInt(scoresArray[i + 1], 10);
  }
  return hash;
}

function introduceDelayForTesting(cb) {
  if(presenceService.testOnly.forceDelay) {
    setTimeout(cb, 120);
  } else {
    cb();
  }
}

function validateUsersSubset(userIds, callback) {
  winston.debug('Validating users', { userIds: userIds });
  // Use a new client due to the WATCH semantics
  var redisClient = redis.createClient();

  function done(err) {
    redisClient.quit();
    return callback(err);
  }

  redisClient.watch(userIds.map(keyUserLock), introduceDelayForTesting(function(err) {
    if(err) return done(err);

    listActiveSockets(function(err, sockets) {
      if(err) return done(err);

      var onlineCounts = {};
      var mobileCounts = {};
      var troupeCounts = {};
      var troupeIdsHash = {};

      // This can't be done in the script manager
      // as that is using a different redis connection
      // and besides we don't know the semanitcs of WATCH
      // in Lua :)

      sockets.forEach(function(socket) {
        var userId = socket.userId;
        var troupeId = socket.troupeId;

        if(userIds.indexOf(userId) >= 0) {
          if(troupeId) {
            troupeIdsHash[troupeId] = true;
            if(socket.eyeballs) {
              if(!troupeCounts[userId]) {
                troupeCounts[userId] = { troupeId: 1 };
              } else {
                troupeCounts[userId][troupeId] = troupeCounts[userId][troupeId] ? troupeCounts[userId][troupeId] + 1 : 1;
              }
            }
          }

          if(socket.mobile) {
            mobileCounts[userId] = mobileCounts[userId] ? mobileCounts[userId] + 1 : 1;
          } else {
            onlineCounts[userId] = onlineCounts[userId] ? onlineCounts[userId] + 1 : 1;
          }
        }
      });

      var f = new Fiber();
      var troupeIds = Object.keys(troupeIdsHash);

      redisClient.zrangebyscore(ACTIVE_USERS_KEY, 1, '+inf', 'WITHSCORES', f.waitor());
      redisClient.zrangebyscore(MOBILE_USERS_KEY, 1, '+inf', 'WITHSCORES', f.waitor());

      troupeIds.forEach(function(troupeId) {
        redisClient.zrangebyscore(keyTroupeUsers(troupeId), 1, '+inf', 'WITHSCORES', f.waitor());
      });

      f.all().then(function(results) {
        var needsUpdate = false;
        var multi = redisClient.multi();

        var currentActiveUserHash = hashZset(results[0]);
        var currentMobileUserHash = hashZset(results[1]);

        userIds.forEach(function(userId) {
          var currentActiveScore = currentActiveUserHash[userId] || 0;
          var currentMobileScore = currentMobileUserHash[userId] || 0;

          var calculatedActiveScore = onlineCounts[userId] || 0;
          var calculatedMobileScore = mobileCounts[userId] || 0;

          if(calculatedActiveScore !== currentActiveScore) {
            winston.info('Inconsistency in active score in presence service for user ', {
              a: typeof calculatedActiveScore,
              b: typeof currentActiveScore
            });
            winston.info('Inconsistency in active score in presence service for user ' + userId + '. ' + calculatedActiveScore + ' vs ' + currentActiveScore);

            needsUpdate = true;
            multi.zrem(ACTIVE_USERS_KEY, userId);
            if(calculatedActiveScore > 0) {
              multi.zincrby(ACTIVE_USERS_KEY, calculatedActiveScore, userId);
            }
          }

          if(calculatedMobileScore !== currentMobileScore) {
            winston.info('Inconsistency in mobile score in presence service for user ' + userId + '. ' + currentMobileScore + ' vs ' + calculatedMobileScore);

            needsUpdate = true;
            multi.zrem(MOBILE_USERS_KEY, userId);
            if(calculatedActiveScore > 0) {
              multi.zincrby(MOBILE_USERS_KEY, calculatedMobileScore, userId);
            }
          }
        });

        // Now check each troupeId for each userId
        troupeIds.forEach(function(troupeId, index) {
          var userTroupeScores = hashZset(results[2 + index]);

          userIds.forEach(function(userId) {
            var currentTroupeScore = userTroupeScores[userId] || 0;

            var calculatedTroupeScore = troupeCounts[userId] && troupeCounts[userId][troupeId] || 0;

            if(calculatedTroupeScore !== currentTroupeScore) {
              winston.info('Inconsistency in troupe score in presence service for user ' + userId + ' in troupe ' + troupeId + '. ' + calculatedTroupeScore + ' vs ' + currentTroupeScore);

              needsUpdate = true;
              var key = keyTroupeUsers(troupeId);
              multi.zrem(key, userId);
              if(calculatedTroupeScore > 0) {
                multi.zincrby(key, calculatedTroupeScore, userId);
              }
            }

          });
        });

        // Nothing to do? Finish
        if(!needsUpdate) return done();

        multi.exec(function(err, replies) {
          if(err) return done(err);

          if(!replies) {
            winston.info('Transaction rolled back.');
            return done({ rollback: true });
          }

          return done();
        });


      }, done);


    });

  }));


}

function validateUsers(callback) {
  var start = Date.now();

  listOnlineUsers(function(err, userIds) {
    if(err) return callback(err);

    if(userIds.length === 0) return callback();

    var userId = null;

    function recurseUserIds(err) {
      if(err && !err.rollback) {
        return callback(err);
      }

      if(!err || !err.rollback) {
        userId = null;
      }

      if(!userId) {
        winston.info('presence:validate:validating next batch');
        if(userIds.length === 0) {
          var total = Date.now() - start;
          winston.info('Presence.validateUsers GC took ' + total + 'ms');
          return callback();
        }

        userId = userIds.shift();
      } else {
        winston.info('presence:validate:revalidating batch');
      }

      validateUsersSubset([userId], recurseUserIds);
    }

    recurseUserIds();
  });
}

  // Connections and disconnections
presenceService.userSocketConnected = userSocketConnected;
presenceService.socketDisconnected =  socketDisconnected;
presenceService.socketDisconnectionRequested = socketDisconnectionRequested;

// Query Status
presenceService.lookupUserIdForSocket =  lookupUserIdForSocket;
presenceService.findOnlineUsersForTroupe =  findOnlineUsersForTroupe;
presenceService.categorizeUsersByOnlineStatus =  categorizeUsersByOnlineStatus;
presenceService.listOnlineUsers = listOnlineUsers;
presenceService.listActiveSockets = listActiveSockets;
presenceService.listMobileUsers =  listMobileUsers;
presenceService.listOnlineUsersForTroupes =  listOnlineUsersForTroupes;
presenceService.categorizeUserTroupesByOnlineStatus = categorizeUserTroupesByOnlineStatus;
presenceService.findAllSocketsForUserInTroupe = findAllSocketsForUserInTroupe;
presenceService.listAllSocketsForUser = listAllSocketsForUser;
presenceService.isUserConnectedWithClientType = isUserConnectedWithClientType;

// Eyeball
presenceService.clientEyeballSignal =  clientEyeballSignal;

  // GC
presenceService.collectGarbage =  collectGarbage;
presenceService.startPresenceGcService =  startPresenceGcService;

presenceService.validateUsers = validateUsers;

// -------------------------------------------------------------------
// Default Events
// -------------------------------------------------------------------

presenceService.on('userOnline', function(userId) {
  winston.info("presence: User " + userId + " connected.");
});

presenceService.on('userOffline', function(userId) {
  winston.info("presence: User " + userId + " disconnected.");
});

presenceService.on('userJoinedTroupe', function(userId, troupeId) {
  /* User joining this troupe for the first time.... */
  winston.info("presence: User " + userId + " has just joined " + troupeId);
  appEvents.userLoggedIntoTroupe(userId, troupeId);
});

presenceService.on('userLeftTroupe', function(userId, troupeId) {
  winston.info("presence: User " + userId + " is gone from " + troupeId);

  appEvents.userLoggedOutOfTroupe(userId, troupeId);
});

presenceService.on('troupeEmpty', function(troupeId) {
  winston.info("presence: The last user has disconnected from troupe " + troupeId);
});

presenceService.testOnly = {
  ACTIVE_USERS_KEY: ACTIVE_USERS_KEY,
  validateUsersSubset: validateUsersSubset,
  forceDelay: false

};


module.exports = presenceService;

