/*jshint globalstrict: true, trailing: false, unused: true, node: true */
"use strict";

var env            = require('gitter-web-env');
var config         = env.config;

var passport       = require('passport');
var expressHbs     = require('express-hbs');
var rememberMe     = require('./middlewares/rememberme-middleware');
var resolveStatic  = require('./resolve-static');
var bodyParser     = require('body-parser');
var cookieParser   = require('cookie-parser');
var methodOverride = require('method-override');
var session        = require('express-session');
var devMode        = config.get('dev-mode');

// Naughty naughty naught, install some extra methods on the express prototype
require('./http');

module.exports = {
  /**
   * Configure express for the full web application
   */
  installFull: function(app) {
    require('./register-helpers')(expressHbs);

    app.locals.googleTrackingId = config.get("stats:ga:key");
    app.locals.googleTrackingDomain = config.get("stats:ga:domain");
    app.locals.liveReload = config.get('web:liveReload');

    app.engine('hbs', expressHbs.express3({
      partialsDir: resolveStatic('/templates/partials'),
      onCompile: function(exhbs, source) {
         return exhbs.handlebars.compile(source, {preventIndent: true});
      },
      layoutsDir: resolveStatic('/layouts'),
      contentHelperName: 'content'
    }));

    app.disable('x-powered-by');
    app.set('view engine', 'hbs');
    app.set('views', resolveStatic('/templates'));
    app.set('trust proxy', true);

    if(config.get('express:viewCache')) {
      app.enable('view cache');
    }

    if(devMode) {
      /* Serve static content */
      require('./express-static').install(app);
    }

    app.use(env.middlewares.accessLogger);
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: false }));

    app.use(cookieParser());
    app.use(methodOverride());
    app.use(require('./middlewares/ie6-post-caching'));
    app.use(require('./middlewares/i18n'));

    var RedisStore = require('connect-redis')(session);
    var sessionStore = new RedisStore({
      client: env.redis.createClient(process.env.REDIS_NOPERSIST_CONNECTION_STRING || config.get("redis_nopersist")),
      ttl: config.get('web:sessionTTL')
    });

    app.use(session({
      secret: config.get('web:sessionSecret'),
      key: config.get('web:cookiePrefix') + 'session',
      store: sessionStore,
      cookie: {
        path: '/',
        httpOnly: true,
        maxAge: 14400000,
        domain: config.get("web:cookieDomain"),
        secure: config.get("web:secureCookies")
      },
      resave: true,
      saveUninitialized: true // Passport will force a save anyway
    }));

    app.use(passport.initialize());
    app.use(passport.session());


    app.use(require('./middlewares/authenticate-bearer'));
    app.use(rememberMe.rememberMeMiddleware);
    app.use(require('./middlewares/rate-limiter'));
    app.use(require('./middlewares/record-client-usage-stats'));

    app.use(require('./middlewares/configure-csrf'));
    app.use(require('./middlewares/enforce-csrf'));

    // NOTE: it might be better to just drop this middleware entirely or at
    // least substantially change the behavior, because not having github
    // tokens is now fine. Maybe it is also fine not having any tokens at all?
    app.use(require('./middlewares/tokenless-user'));
  },

  installApi: function(app) {
    app.disable('x-powered-by');
    app.set('trust proxy', true);

    app.use(env.middlewares.accessLogger);

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(methodOverride());

    app.use(require('./middlewares/ie6-post-caching'));
    app.use(require('./middlewares/i18n'));

    app.use(passport.initialize());
    app.use(require('./middlewares/rate-limiter'));
    app.use(require('./middlewares/record-client-usage-stats'));
  },

  installSocket: function(app) {
    app.disable('x-powered-by');
    app.set('trust proxy', true);
    app.use(env.middlewares.accessLogger);
    app.use(require('./middlewares/token-error-handler'));
    app.use(env.middlewares.errorHandler);
  }
};
