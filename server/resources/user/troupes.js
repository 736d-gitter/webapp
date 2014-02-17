/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var troupeService = require("../../services/troupe-service");
var restful = require("../../services/restful");
var restSerializer = require("../../serializers/rest-serializer");
var recentRoomService = require('../../services/recent-room-service');
var roomService = require('../../services/room-service');
var Q = require('q');

module.exports = {
  base: 'troupes',
  id: 'userTroupe',
  index: function(req, res, next) {
    if(!req.user) {
      return res.send(403);
    }

    restful.serializeTroupesForUser(req.resourceUser.id)
      .then(function(serialized) {
        res.send(serialized);
      })
      .fail(next);
  },

  show: function(req, res, next) {
    var strategy = new restSerializer.TroupeStrategy({ currentUserId: req.resourceUser.id, mapUsers: true });

    restSerializer.serialize(req.userTroupe, strategy, function(err, serialized) {
      if(err) return next(err);

      res.send(serialized);
    });
  },

  update: function(req, res, next) {
    var troupe = req.userTroupe;
    var updatedTroupe = req.body;
    var userId = req.user.id;
    var troupeId = troupe.id;
    var promises = [];

    if('favourite' in updatedTroupe) {
      var fav = updatedTroupe.favourite;

      if(!fav || troupeService.userHasAccessToTroupe(req.resourceUser, troupe)) {
        promises.push(recentRoomService.updateFavourite(userId, troupeId, fav));
      } else {
        // The user has added a favourite that they don't belong to
        // Add them to the room first
        promises.push(
          roomService.findOrCreateRoom(req.resourceUser, troupe.uri)
            .then(function() {
              return recentRoomService.updateFavourite(userId, troupeId, updatedTroupe.favourite);
            })
          );
      }
    }

    if('lurk' in updatedTroupe) {
      promises.push(troupeService.updateTroupeLurkForUserId(userId, troupeId, updatedTroupe.lurk));
    }

    return Q.all(promises)
      .then(function() {
        var strategy = new restSerializer.TroupeIdStrategy({ currentUserId: userId });

        return restSerializer.serializeQ(troupeId, strategy);
      })
      .then(function(troupe) {
        res.send(troupe);
      })
      .fail(next);
  },

  destroy: function(req, res, next) {
    var troupe = req.userTroupe;
    var userId = req.user.id;

    return recentRoomService.removeRecentRoomForUser(userId, troupe)
      .then(function() {
        res.send({ success: true });
      })
      .fail(next);
  },


  load: function(req, id, callback) {
    troupeService.findById(id, function(err, troupe) {
      if(err) return callback(err);

      if(!troupe) return callback();

      var nonMembersAllowed = req.method === 'DELETE' || req.method === 'POST';

      /* Some strangeness here as the user may be mentioned */
      if(!(nonMembersAllowed || troupeService.userHasAccessToTroupe(req.resourceUser, troupe))) {
        return callback(403);
      }

      return callback(null, troupe);
    });
  }

};
