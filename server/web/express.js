/*jshint globalstrict: true, trailing: false, unused: true, node: true */
"use strict";

var env = require('../utils/env');
var config          = env.config;

var express        = require('express');
var passport       = require('passport');
var expressHbs     = require('express-hbs');
var path           = require('path');
var rememberMe     = require('./middlewares/rememberme-middleware');

// Naughty naughty naught, install some extra methods on the express prototype
require('./http');


var staticContentDir = path.join(__dirname, '..', '..', config.get('web:staticContent'));

module.exports = {
  /**
   * Configure express for the full web application
   */
  installFull: function(app, server, sessionStore) {
    expressHbs.registerHelper('cdn', require('./hbs-helpers').cdn);
    expressHbs.registerHelper('bootScript', require('./hbs-helpers').bootScript);
    expressHbs.registerHelper('isMobile', require('./hbs-helpers').isMobile);
    expressHbs.registerHelper('generateEnv', require('./hbs-helpers').generateEnv);
    expressHbs.registerHelper('generateTroupeContext', require('./hbs-helpers').generateTroupeContext);
    expressHbs.registerAsyncHelper('prerenderView', require('./prerender-helper'));
    expressHbs.registerHelper('chatItemPrerender', require('./prerender-chat-helper'));

    app.locals({
      googleTrackingId: config.get("web:trackingId"),
      minified: config.get('web:minified')
    });

    app.engine('hbs', expressHbs.express3({
      partialsDir: staticContentDir + '/templates/partials',
      layoutsDir: staticContentDir + '/layouts',
      contentHelperName: 'content'
    }));

    app.set('view engine', 'hbs');
    app.set('views', staticContentDir + '/templates');
    app.set('trust proxy', true);

    if(config.get('express:viewCache')) {
      app.enable('view cache');
    }

    if(config.get("logging:logStaticAccess")) {
      app.use(env.middlewares.accessLogger);
    }

    app.use(express.static(staticContentDir, {
      maxAge: config.get('web:staticContentExpiryDays') * 86400 * 1000
    }));

    if(!config.get("logging:logStaticAccess")) {
    }

    app.use(express.cookieParser());
    app.use(express.urlencoded());
    app.use(express.json());
    app.use(express.methodOverride());
    app.use(require('./middlewares/ie6-post-caching'));

    // TODO remove this by 9/May/2014
    app.use(function(req, res, next) {
      Object.keys(req.cookies).forEach(function(key) {
        if(key.indexOf('optimizely') === 0) {
          res.clearCookie(key);
        }
      });

      next();
    });

    app.use(express.session({
      secret: config.get('web:sessionSecret'),
      key: config.get('web:cookiePrefix') + 'session',
      store: sessionStore,
      cookie: {
        path: '/',
        httpOnly: true,
        maxAge: 14400000,
        domain: config.get("web:cookieDomain"),
        secure: false /*config.get("web:secureCookies")*/ // TODO: fix this!!
      }
    }));

    app.use(passport.initialize());
    app.use(passport.session());

    app.use(require('./middlewares/authenticate-bearer'));
    app.use(rememberMe.rememberMeMiddleware);
    app.use(require('./middlewares/rate-limiter'));

    app.use(require('./middlewares/configure-csrf'));
    app.use(require('./middlewares/enforce-csrf'));

    app.use(require('./middlewares/tokenless-user'));

    app.use(app.router);

    app.use(require('./middlewares/token-error-handler'));
    app.use(require('./middlewares/express-error-handler'));
  },

  installApi: function(app) {
    app.set('trust proxy', true);

    app.use(env.middlewares.accessLogger);

    app.use(express.urlencoded());
    app.use(express.json());
    app.use(express.methodOverride());

    app.use(require('./middlewares/ie6-post-caching'));

    app.use(passport.initialize());
    app.use(app.router);

    app.use(require('./middlewares/token-error-handler'));
    app.use(env.middlewares.errorHandler);
  },

  installSocket: function(app) {
    app.set('trust proxy', true);
    app.use(env.middlewares.accessLogger);
    app.use(express.cookieParser());
    app.use(express.urlencoded());
    app.use(express.json());

    app.use(require('./middlewares/token-error-handler'));
    app.use(env.middlewares.errorHandler);
  }
};
