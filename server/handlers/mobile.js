"use strict";

var ensureLoggedIn = require('../web/middlewares/ensure-logged-in');
var appRender      = require('./app/render');
var express        = require('express');
var identifyRoute  = require('gitter-web-env').middlewares.identifyRoute;

var router = express.Router({ caseSensitive: true, mergeParams: true });

router.get('/embedded-chat',
  identifyRoute('mobile-embedded-chat'),
  appRender.renderMobileNativeEmbeddedChat);

router.get('/home',
  ensureLoggedIn,
  identifyRoute('mobile-home'),
  appRender.renderMobileNativeUserhome);

module.exports = router;
