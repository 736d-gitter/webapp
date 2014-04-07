/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var middleware = require("../web/middleware");
var loginUtils = require('../web/login-utils');
var nconf      = require('../utils/config');

module.exports = {
    install: function(app) {
      app.get(nconf.get('web:homeurl'),
        middleware.ensureValidBrowser,
        middleware.grantAccessForRememberMeTokenMiddleware,
        function(req, res, next) {

          if(req.user) {
            loginUtils.redirectUserToDefaultTroupe(req, res, next);
            return;
          }

          // when the viewer is not logged in:
          res.render('homepage');
        });

      if (nconf.get('web:homeurl') !== '/') {
        app.get('/',
          middleware.grantAccessForRememberMeTokenMiddleware,
          function(req, res) {
            if(req.user) {
              res.relativeRedirect(nconf.get('web:homeurl'));
              return;
            }

            res.render('landing');
          });
      }

    }
};
