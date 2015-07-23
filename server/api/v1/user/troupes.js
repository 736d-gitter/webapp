/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var troupeService        = require("../../../services/troupe-service");
var restful              = require("../../../services/restful");
var restSerializer       = require("../../../serializers/rest-serializer");
var recentRoomService    = require('../../../services/recent-room-service');
var roomMembershipService = require('../../../services/room-membership-service');
var roomService          = require('../../../services/room-service');
var Q                    = require('q');
var mongoUtils           = require('../../../utils/mongo-utils');
var StatusError          = require('statuserror');

module.exports = {
  id: 'userTroupe',
  index: function(req, res, next) {
    if(!req.user) {
      return res.sendStatus(403);
    }

    restful.serializeTroupesForUser(req.resourceUser.id)
      .then(function(serialized) {
        res.send(serialized);
      })
      .fail(next);
  },

  show: function(req, res, next) {
    var strategyOptions = { currentUserId: req.resourceUser.id };
    // if (req.query.include_users) strategyOptions.mapUsers = true;

    var strategy = new restSerializer.TroupeStrategy(strategyOptions);

    restSerializer.serialize(req.userTroupe, strategy, function(err, serialized) {
      if(err) return next(err);

      res.send(serialized);
    });
  },

  update: function(req, res, next) {
    var userId = req.user.id;
    var troupe = req.userTroupe;
    var troupeId = troupe.id;

    return roomMembershipService.checkRoomMembership(troupeId, userId)
      .then(function(isMember) {

        var updatedTroupe = req.body;
        var troupeId = troupe.id;
        var promises = [];

        if('favourite' in updatedTroupe) {
          var fav = updatedTroupe.favourite;

          if(!fav || isMember) {
            promises.push(recentRoomService.updateFavourite(userId, troupeId, fav));
          } else {
            // The user has added a favourite that they don't belong to
            // Add them to the room first
            if (!troupe.oneToOne) {
              /* Ignore one-to-one rooms */
              promises.push(
                roomService.findOrCreateRoom(req.resourceUser, troupe.uri)
                  .then(function() {
                    return recentRoomService.updateFavourite(userId, troupeId, updatedTroupe.favourite);
                  })
                );
            }
          }
        }

        if('lurk' in updatedTroupe) {
          if (isMember && !troupe.oneToOne) {
            promises.push(roomService.updateTroupeLurkForUserId(userId, troupeId, updatedTroupe.lurk));
          }
        }

        return Q.all(promises);
      })
      .then(function() {
        var strategy = new restSerializer.TroupeStrategy({ currentUserId: userId });

        return restSerializer.serializeQ(troupe, strategy);
      })
      .then(function(troupe) {
        res.send(troupe);
      })
      .fail(next);
  },

  /**
   * Hides a room from the menu. A user can only request this
   * on their own behalf.
   *
   * DELETE /users/:userId/rooms/:roomId
   */
  destroy: function(req, res, next) {
    return roomService.hideRoomFromUser(req.userTroupe._id, req.user._id)
      .then(function() {
        res.send({ success: true });
      })
      .fail(next);
  },

  load: function(req, id, callback) {
    /* Invalid id? Return 404 */
    if(!mongoUtils.isLikeObjectId(id)) return callback();

    return troupeService.findByIdLeanWithAccess(id, req.user && req.user._id)
      .spread(function(troupe, access) {
        if(!troupe) throw new StatusError(404);

        if(troupe.security === 'PUBLIC' && req.method === 'GET') {
          return troupe;
        }

        /* From this point forward we need a user */
        if(!req.user) {
          throw new StatusError(401);
        }

        if(!access) {
          throw new StatusError(403);
        }

        return troupe;
      })
      .nodeify(callback);
  },

  subresources: {
    'settings': require('./troupe-settings'),
    'unreadItems': require('./unread-items'),
    'collapsedItems': require('./collapsed-items')
  }
};
