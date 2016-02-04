'use strict';

var LRU             = require("lru-cache");
var Q               = require('bluebird-q');
var GithubRepo      = require('gitter-web-github').GitHubRepoService;
var MAX_TOKEN_AGE   = 10 * 60000; // 2 minutes
var debug           = require('debug')('gitter:legacy-recommendations');

var publicRoomCache = LRU({
  max: 20,
  maxAge: MAX_TOKEN_AGE
});


module.exports = function getCachedRepo(user, uri) {
  var room = publicRoomCache.get(uri);
  if (room) {
    return Q.resolve(room);
  }

  debug('Room %s not in cache, fetching from Github', uri);
  var ghRepo = new GithubRepo(user);
  return ghRepo.getRepo(uri)
    .then(function(room) {
      publicRoomCache.set(uri, room);
      return room;
    });

};
