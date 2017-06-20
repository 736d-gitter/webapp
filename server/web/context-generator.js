/*jshint globalstrict: true, trailing: false, unused: true, node: true */
"use strict";

var restSerializer   = require("../serializers/rest-serializer");
var presenceService  = require("gitter-web-presence");
var useragent        = require("useragent");
var userService      = require('../services/user-service');
var userSettingsService = require('../services/user-settings-service');
var isNative         = require('../../public/js/utils/is-native');

var assert           = require("assert");
var Q                = require('q');
var _                = require('underscore');

/**
 * Returns the promise of a mini-context
 */
exports.generateNonChatContext = function(req) {
  var user = req.user;

  return Q.all([
      user ? serializeUser(user) : null,
      user ? determineDesktopNotifications(user, req) : false,
      user ? userSettingsService.getUserSettings(user.id, 'suggestedRoomsHidden') : false,
    ])
    .spread(function (serializedUser, desktopNotifications, suggestedRoomsHidden) {
      return createTroupeContext(req, {
        user: serializedUser,
        suggestedRoomsHidden: suggestedRoomsHidden,
        desktopNotifications: desktopNotifications,
      });
    });
};

exports.generateSocketContext = function(userId, troupeId) {
  function getUser() {
    if (!userId) return Q.resolve(null);
    return userService.findById(userId);
  }

  return getUser()
    .then(function(user) {
      return [
        user && serializeUser(user),
        troupeId && serializeTroupeId(troupeId, user)
      ];
    })
    .spread(function(serializedUser, serializedTroupe) {
      return {
        user: serializedUser || undefined,
        troupe: serializedTroupe  || undefined
      };
    });
};

exports.generateTroupeContext = function(req, extras) {
  var user = req.user;
  var uriContext = req.uriContext;
  assert(uriContext);

  var troupe = req.uriContext.troupe;

  return Q.all([
    user ? serializeUser(user) : null,
    troupe ? serializeTroupe(troupe, user) : undefined,
    determineDesktopNotifications(user, req)
  ])
  .spread(function(serializedUser, serializedTroupe, desktopNotifications) {

    return createTroupeContext(req, {
      user: serializedUser,
      troupe: serializedTroupe,
      desktopNotifications: desktopNotifications,
      extras: extras
    });
  });
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
  } else if (os.indexOf('Linux') === 0) {
    clientType= 'linux';
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
  return isNative(req.headers['user-agent']);
}

function serializeUser(user) {
  var strategy = new restSerializer.UserStrategy({
    exposeRawDisplayName: true,
    includeScopes: true,
    includePermissions: true,
    showPremiumStatus: true
  });

  return restSerializer.serialize(user, strategy);
}

function serializeTroupeId(troupeId, user) {
  var strategy = new restSerializer.TroupeIdStrategy({
    currentUserId: user ? user.id : null,
    currentUser: user,
    includePermissions: true,
    includeOwner: true
  });

  return restSerializer.serialize(troupeId, strategy);
}


function serializeTroupe(troupe, user) {
  var strategy = new restSerializer.TroupeStrategy({
    currentUserId: user ? user.id : null,
    currentUser: user,
    includePermissions: true,
    includeOwner: true
  });

  return restSerializer.serialize(troupe, strategy);
}

function createTroupeContext(req, options) {
  var events = req.session && req.session.events;
  var extras = options.extras || {};
  if (events) { req.session.events = []; }

  return _.extend({
    roomMember: req.uriContext && req.uriContext.roomMember,
    user: options.user,
    troupe: options.troupe,
    homeUser: options.homeUser,
    accessToken: req.accessToken,
    suggestedRoomsHidden: options.suggestedRoomsHidden,
    desktopNotifications: options.desktopNotifications,
    events: events,
    troupeUri: options.troupe ? options.troupe.uri : undefined,
    troupeHash: options.troupeHash,
    isNativeDesktopApp: isNativeDesktopApp(req),
    permissions: options.permissions,
    locale: req.i18n.locales[req.i18n.locale]
  }, extras);
}
