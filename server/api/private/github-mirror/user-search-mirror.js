/*jshint globalstrict: true, trailing: false, unused: true, node: true */
"use strict";

var Mirror      = require("../../../services/github/github-mirror-service")('user');
var userService = require('../../../services/user-service');
var winston     = require('../../../utils/winston');
var url         = require('url');
module.exports = function(req, res, next) {
  if(!req.user) return next(401);

  var githubUri = url.format({ pathname: 'search/users', query: req.query });

  var mirror = new Mirror(req.user);

  mirror.get(githubUri).then(function(body) {
    if(!body || !body.items || !body.items.length) return res.send(body);

    var logins = body.items.map(function(i) {
      return i.login;
    });

    return userService.githubUsersExists(logins)
      .then(function(exists) {
        body.items.forEach(function(item) {
          item.has_gitter_login = exists[item.login];
        });

        return res.send(body);
      })
      .fail(function(err) {
        winston.error('githubUsersExists failed' + err, { exception: err });
        res.send(body);
      });

  }).fail(next);

};
