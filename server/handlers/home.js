'use strict';

var express = require('express');
var urlJoin = require('url-join');
var ensureLoggedIn = require('../web/middlewares/ensure-logged-in');
var timezoneMiddleware = require('../web/middlewares/timezone');
var isPhoneMiddleware = require('../web/middlewares/is-phone');
var featureToggles = require('../web/middlewares/feature-toggles');
var userHomeRenderer = require('./renderers/userhome');
var mainFrameRenderer = require('./renderers/main-frame');
var identifyRoute = require('gitter-web-env').middlewares.identifyRoute;
var preventClickjackingMiddleware = require('../web/middlewares/prevent-clickjacking');
var preventClickjackingOnlyGitterEmbedMiddleware = require('../web/middlewares/prevent-clickjacking-only-gitter-embed');

var router = express.Router({ caseSensitive: true, mergeParams: true });

router.get(
  '/',
  identifyRoute('home-main'),
  featureToggles,
  preventClickjackingMiddleware,
  isPhoneMiddleware,
  timezoneMiddleware,
  function(req, res, next) {
    if (req.isPhone) {
      userHomeRenderer.renderMobileUserHome(req, res, next, 'home');
    } else {
      mainFrameRenderer.renderMainFrame(req, res, next, {
        subFrameLocation: '/home/~home',
        title: 'Home',
        suggestedMenuState: 'search'
      });
    }
  }
);

router.get(
  '/~home',
  identifyRoute('home-frame'),
  ensureLoggedIn,
  preventClickjackingOnlyGitterEmbedMiddleware,
  featureToggles,
  isPhoneMiddleware,
  function(req, res, next) {
    userHomeRenderer.renderHomePage(req, res, next);
  }
);

// Used for the create button on `/home`
router.get(
  '/createroom',
  identifyRoute('create-room-redirect'),
  ensureLoggedIn,
  preventClickjackingMiddleware,
  featureToggles,
  function(req, res) {
    res.redirect('/home#createroom');
  }
);

router.get(
  new RegExp('/explore(.*)?'),
  identifyRoute('home-explore'),
  preventClickjackingMiddleware,
  featureToggles,
  isPhoneMiddleware,
  function(req, res, next) {
    if (!req.user) {
      return res.redirect('/explore');
    }

    var exploreParam = req.params[0] || '';
    var subFrameLocation = urlJoin('/home/~explore', exploreParam);

    var renderer = mainFrameRenderer.renderMainFrame;
    if (req.isPhone) {
      renderer = mainFrameRenderer.renderMobileMainFrame;
    }

    renderer(req, res, next, {
      subFrameLocation: subFrameLocation,
      title: 'Explore',
      suggestedMenuState: 'search'
    });
  }
);

router.get(
  '/learn',
  identifyRoute('home-learn-main'),
  ensureLoggedIn,
  preventClickjackingMiddleware,
  featureToggles,
  isPhoneMiddleware,
  function(req, res, next) {
    var renderer = mainFrameRenderer.renderMainFrame;
    if (req.isPhone) {
      renderer = mainFrameRenderer.renderMobileMainFrame;
    }

    renderer(req, res, next, {
      subFrameLocation: '/learn/~learn',
      title: 'Learn',
      suggestedMenuState: 'search'
    });
  }
);

module.exports = router;
