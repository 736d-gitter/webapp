'use strict';

var env   = require('gitter-web-env');
var stats = env.stats;
var cypher = require("cypher-promise");
var neo4jClient = cypher(env.config.get('neo4j:endpoint'));
var debug = require('debug')('gitter:graph-suggestions');
var _ = require('lodash');

function query(text, params) {
  debug("neo4j query: %s %j", text, params);
  var start = Date.now();

  return neo4jClient.query(text, params)
    .then(function(response) {
      stats.responseTime('suggestions.graph.query', Date.now() - start);
      return response;
    })
    .catch(function(err) {
      stats.event('chat.search.error');
      throw err;
    });
  }

function queryRoomSuggestions(roomId, userId) {
  if (userId) {
    /* Given a user .... */
    return query("MATCH (r:Room)-[:MEMBER]-(:User)-[:MEMBER]-(r2:Room), (u:User) " +
                 "WHERE u.userId = {userId} AND r.roomId = {roomId} AND NOT(u-[:MEMBER]-r2) AND r2.security = 'PUBLIC'" +
                 "RETURN r2.roomId, count(*) * r2.weight as occurrence " +
                 "ORDER BY occurrence DESC " +
                 "LIMIT 6",
    {
      roomId: roomId,
      userId: userId
    });
  }

  /* Anonymous query */
  return query("MATCH (r:Room)-[:MEMBER]-(:User)-[:MEMBER]-(r2:Room)" +
               "WHERE r.roomId = {roomId} AND r2.security = 'PUBLIC'" +
               "RETURN r2.roomId, count(*) * r2.weight as occurrence " +
               "ORDER BY occurrence DESC " +
               "LIMIT 6",
  {
    roomId: roomId
  });
}
/** Returns the ids of rooms suggested for the current user */
function getSuggestionsForRoom(room, user/*, locale */) {
  return queryRoomSuggestions(room.id, user && user.id)
    .then(function(results) {
      return results.data.map(function(f) {
        /* Return the roomId only */
        return { roomId: f[0] };
      });
    });

}
exports.getSuggestionsForRoom = getSuggestionsForRoom;

/* Returns the ids of rooms suggested for the current user */
function getSuggestionsForUser(user /*, locale */) {
  return query("MATCH (u:User)-[:MEMBER]->(:Room)-[:MEMBER]-(:User)-[:MEMBER]-(r:Room) " +
               "WHERE u.userId = {userId} AND NOT(u-[:MEMBER]-r) AND r.security = 'PUBLIC'" +
               "RETURN r.roomId, count(*) * r.weight as occurrence " +
               "ORDER BY occurrence DESC " +
               "LIMIT 6",
          {
            userId: user.id,
          })
    .then(function(results) {
      return results.data.map(function(f) {
        return { roomId: f[0] };
      });
    });
}
exports.getSuggestionsForUser = getSuggestionsForUser;


function getSuggestionsForRooms(rooms) {
  var roomIds = _.pluck(rooms, 'id');
  // original, breaks prod:
  /*
  var qry = 'MATCH (r:Room)-[:MEMBER]-(u:User)-[:MEMBER]-(s:Room) ' +
    'WHERE r.roomId IN {roomIds} '+
    'AND (NOT s.roomId IN {roomIds}) AND s.security <> "PRIVATE" '+
    'RETURN s.roomId, count(*) AS linkcount '+
    'ORDER BY linkcount DESC '+
    'LIMIT 10';
  */
  var qry = 'MATCH (r:Room)-[m:MEMBER]-(u:User) '+
    'WHERE r.roomId IN {roomIds} ' +
    'WITH u ORDER BY m.weight LIMIT 1000 ' +
    'MATCH (u)-[:MEMBER]-(r2:Room) ' +
    'WHERE NOT r2.roomId IN {roomIds} AND r2.security <> "PRIVATE" ' +
    'RETURN r2.roomId AS roomId, count(r2) AS c ' +
    'ORDER BY c DESC ' +
    'LIMIT 10';

  var attrs = {roomIds: roomIds};
  return query(qry, attrs)
    .then(function(results) {
      return results.data.map(function(f) {
        return { roomId: f[0] };
      });
    });
}
exports.getSuggestionsForRooms = getSuggestionsForRooms;
