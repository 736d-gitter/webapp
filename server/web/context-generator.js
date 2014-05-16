/*jshint globalstrict: true, trailing: false, unused: true, node: true */
"use strict";

var restSerializer   = require("../serializers/rest-serializer");
var presenceService  = require("../services/presence-service");
var useragent        = require("useragent");
var crypto           = require("crypto");
var roomPermissionsModel = require('../services/room-permissions-model');
var assert           = require("assert");
var appVersion       = require("./appVersion");
var Q                = require('q');
var languageSelector = require('./language-selector');

/**
 * Returns the promise of a mini-context
 */
exports.generateNonChatContext = function(req, callback) {
  var user = req.user;

  return Q.all([
      user ? serializeUser(user) : null,
      user ? determineDesktopNotifications(user, req) : false
    ])
    .spread(function(serializedUser, desktopNotifications) {
      return createTroupeContext(req, {
        user: serializedUser,
        desktopNotifications: desktopNotifications,
      });
    })
    .nodeify(callback);
};

exports.generateSocketContext = function(userId, troupeId, callback) {
  return Q.all([
      serializeUserId(userId),
      troupeId && serializeTroupeId(troupeId, userId) || undefined
    ])
    .spread(function(serializedUser, serializedTroupe) {
      return {
        user: serializedUser,
        troupe: serializedTroupe
      };
    })
    .nodeify(callback);
};

exports.generateTroupeContext = function(req, callback) {
  var user = req.user;
  var uriContext = req.uriContext;
  assert(uriContext);

  var troupe = req.uriContext.troupe;
  var homeUser = req.uriContext.oneToOne && req.uriContext.otherUser; // The users page being looked at

  var troupeHash;
  if(troupe) {
    var cipher = crypto.createCipher('aes256', '***REMOVED***');
    var hash   = cipher.update(troupe.id, 'utf8', 'hex') + cipher.final('hex');
    troupeHash  = hash;
  }

  return Q.all([
    user ? serializeUser(user) : null,
    homeUser ? serializeHomeUser(homeUser) : undefined, //include email if the user has an invite
    troupe ? serializeTroupe(troupe, user) : undefined,
    determineDesktopNotifications(user, req),
    roomPermissionsModel(user, 'admin', troupe)
  ])
  .spread(function(serializedUser, serializedHomeUser, serializedTroupe, desktopNotifications, adminAccess) {

    var status;
    if(user) {
      status = user.status;
    }

    return createTroupeContext(req, {
      user: serializedUser,
      homeUser: serializedHomeUser,
      troupe: serializedTroupe,
      desktopNotifications: desktopNotifications,
      troupeHash: troupeHash,
      permissions: {
        admin: adminAccess
      }
    });
  })
  .nodeify(callback);
};

/**
 * Figures out whether to use desktop notifications for this user
 */

function determineDesktopNotifications(user, req) {
  if(!user) return true;

  var agent = useragent.parse(req.headers['user-agent']);
  var os = agent.os.family;
  var clientType;

  if(os === 'Mac OS X') {
    clientType = 'osx';
  } else if(os.indexOf('Windows') === 0) {
    clientType = 'win';
  }

  if(clientType) {
    return Q.nfcall(presenceService.isUserConnectedWithClientType, user.id, clientType)
      .then(function(result) {
        return !result;
      });
  }

  return true;

}

function isNativeDesktopApp(req) {
  var agent = useragent.parse(req.headers['user-agent']);
  return agent.family === 'Other';
}

function serializeUser(user) {
  var strategy = new restSerializer.UserStrategy({ exposeRawDisplayName: true, includeScopes: true, includePermissions: true });

  return restSerializer.serializeQ(user, strategy);
}

function serializeUserId(userId) {
  var strategy = new restSerializer.UserIdStrategy({ exposeRawDisplayName: true, includeScopes: true, includePermissions: true });

  return restSerializer.serializeQ(userId, strategy);
}

function serializeHomeUser(user, includeEmail) {
  var strategy = new restSerializer.UserStrategy({ includeEmail: includeEmail, hideLocation: true });

  return restSerializer.serializeQ(user, strategy);
}

function serializeTroupeId(troupeId, userId) {
  var strategy = new restSerializer.TroupeIdStrategy({ currentUserId: userId });

  return restSerializer.serializeQ(troupeId, strategy);
}


function serializeTroupe(troupe, user) {
  var strategy = new restSerializer.TroupeStrategy({ currentUserId: user ? user.id : null });

  return restSerializer.serializeQ(troupe, strategy);
}

function createTroupeContext(req, options) {
  var events = req.session && req.session.events;
  if(events) { req.session.events = []; }

  console.log(req.i18n);

  return {
    user: options.user,
    troupe: options.troupe,
    homeUser: options.homeUser,
    accessToken: req.accessToken,
    appVersion: appVersion.getCurrentVersion(),
    desktopNotifications: options.desktopNotifications,
    events: events,
    troupeUri: options.troupe ? options.troupe.uri : undefined,
    troupeHash: options.troupeHash,
    isNativeDesktopApp: isNativeDesktopApp(req),
    permissions: options.permissions,
    lang: languageSelector(req),
    locale: req.i18n.locales[req.i18n.locale]
  };
}
