"use strict";

var oauthService    = require('../../services/oauth-service');
var restSerializer  = require('../../serializers/rest-serializer');
var Promise         = require('bluebird');

module.exports =  function(req, res, next) {
  var strategy = new restSerializer.UserStrategy();

  return Promise.join(
    restSerializer.serialize(req.user, strategy),
    oauthService.findOrGenerateIRCToken(req.user.id),
    function(serialized, token) {
      res.send({ token: token, user: serialized });
    })
    .catch(next);


};
