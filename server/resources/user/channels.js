/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var roomService    = require("../../services/room-service");
var restSerializer = require("../../serializers/rest-serializer");

function serialize(items, req, res, next) {

  var strategy = new restSerializer.TroupeStrategy({ currentUserId: req.user.id });

  restSerializer.serialize(items, strategy, function(err, serialized) {
    if(err) return next(err);

    res.send(serialized);
  });

}

module.exports = {
  id: 'userTroupe',

  index: function(req, res, next) {
    roomService.findAllChannelsForUser(req.user, function(err, channelTroupes) {
      if(err) return next(err);

      serialize(channelTroupes, req, res, next);
    });
  },

  create: function(req, res, next) {
    var body = req.body;
    var security = body.security || 'INHERITED';

    return roomService.createCustomChildRoom(null, req.user, { name: body.name, security: security })
      .then(function(customRoom) {
        return serialize(customRoom, req, res, next);
      })
      .fail(function(err) {
        if(err.clientDetail && err.responseStatusCode) {
          res.send(err.responseStatusCode, err.clientDetail);
        } else {
          next(err);
        }
      });
  },

  load: function(req, id, callback){
    roomService.findUsersChannelRoom(req.user, id, callback);
  }

};
