"use strict";

var roomService         = require("../../../services/room-service");
var restSerializer      = require("../../../serializers/rest-serializer");
var loadTroupeFromParam = require('./load-troupe-param');

function serialize(items, req) {
  var strategy = new restSerializer.TroupeStrategy({ currentUserId: req.user.id });

  return restSerializer.serialize(items, strategy);
}

module.exports = {
  id: 'channel',
  index: function(req) {
    return roomService.findAllChannelsForRoomId(req.user, req.params.troupeId)
      .then(function(channelTroupes) {
        return serialize(channelTroupes, req);
      });
  },

  create: function(req, res) {
    return loadTroupeFromParam(req)
      .then(function(troupe) {
        var body = req.body;
        var security = body.security || 'INHERITED';

        return roomService.createCustomChildRoom(troupe, req.user, { name: body.name, security: security });
      })
      .then(function(customRoom) {
        return serialize(customRoom, req);
      })
      .catch(function(err) {
        if(err.clientDetail && err.responseStatusCode) {
          res.status(err.responseStatusCode);
          return err.clientDetail;
        }

        throw err;
      });
  },

  load: function(req, id) {
    return roomService.findChildChannelRoom(req.user, req.params.troupeId, id);
  }

};
