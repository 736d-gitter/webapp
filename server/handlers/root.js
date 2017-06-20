"use strict";

var express       = require('express');
var loginUtils    = require('../web/login-utils');
var nconf         = require('../utils/config');
var social        = require('./social-metadata');
var langs         = require('langs');
var identifyRoute = require('gitter-web-env').middlewares.identifyRoute;
var router        = express.Router({ caseSensitive: true, mergeParams: true });

router.get(nconf.get('web:homeurl'),
  identifyRoute('homepage'),
  require('../web/middlewares/unawesome-browser'),
  function(req, res, next) {

    if(req.user && req.query.redirect !== 'no') {
      loginUtils.redirectUserToDefaultTroupe(req, res, next);
      return;
    }

    var locale = req.i18n.getLocale();
    var requested = req.headers["accept-language"] || "";
    requested = requested.split(";")[0] || "";
    requested = requested.split(/,\s*/)[0];
    requested = requested.split("-")[0];

    var requestLangCode, requestLangLocalName;
    if (locale !== requested) {
      var requestLang = langs.where("1", requested);
      if (requestLang) {
        requestLangCode = requestLang["1"];
        requestLangLocalName = requestLang.local;
      }
    }

    var translatedBy = req.i18n.__("Translated By");
    /* i18n doesn't like empty strings. Use a dash as a proxy */
    if (translatedBy === "-") translatedBy = "";

    // when the viewer is not logged in:
    res.render('homepage', {
      useOptimizely: locale === 'en',
      wordy: locale === 'ru',
      translationRequired: locale !== requested,
      requestLangCode: requestLangCode,
      requestLangLocalName: requestLangLocalName,
      translated: translatedBy,
      socialMetadata: social.getMetadata(),
      billingBaseUrl: nconf.get('web:billingBaseUrl')
    });
  });


if (nconf.get('web:homeurl') !== '/') {
  router.get('/',
    identifyRoute('homepage-landing'),
    function(req, res) {
      if(req.user) {
        if(req.query.redirect === 'no') {
          res.relativeRedirect(nconf.get('web:homeurl') + '?redirect=no');
        } else {
          res.relativeRedirect(nconf.get('web:homeurl'));
        }
        return;
      }

      res.render('landing');
    });
}

router.get('/apps',
  identifyRoute('homepage-apps'),
  function (req, res) {
    var userAgent = req.headers['user-agent'] || '';
    var compactView = userAgent.indexOf("Mobile/") >= 0;
    res.render('apps', {
      compactView: compactView,
      homeUrl: nconf.get('web:homeurl')
    });
  });

router.get('/robots.txt',
  identifyRoute('homepage-robots'),
  function(req, res) {
    res.set('Content-Type', 'text/text');
    res.render('robotstxt', {
      allowCrawling: nconf.get('sitemap:allowCrawling'),
      sitemap: nconf.get('sitemap:location')
    });
  });

router.get('/humans.txt',
  identifyRoute('homepage-humans'),
  function(req, res) {
    res.set('Content-Type', 'text/text');
    res.render('humanstxt');
  });

router.get('/-/unawesome-browser',
  identifyRoute('homepage-unawesome-browser'),
  function(req, res) {
    res.status(406/* Not Acceptable */).render('unawesome-browser', { });
  });

// old campaign that still gets some hits
router.get('/about/*',
  identifyRoute('homepage-about'),
  function(req, res) {
    res.redirect(nconf.get('web:homeurl'));
  });


// This really doesn't seem like the right place for this?
// Does anyone know what this is for?
router.get('/_s/cdn/*',
  identifyRoute('homepage-cdn'),
  function(req, res) {
    res.redirect(req.path.replace('/_s/cdn', ''));
  });

module.exports = router;
