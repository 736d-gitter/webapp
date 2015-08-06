/*jshint globalstrict: true, trailing: false, unused: true, node: true */
"use strict";

var nconf           = require('../utils/config');
var cdn             = require("./cdn");
var _               = require('underscore');
var appVersion      = require('./appVersion');
var safeJson        = require('../utils/safe-json');
var env             = process.env.NODE_ENV;
var util            = require('util');

var cdns;
if(nconf.get("cdn:use")) {
  cdns = nconf.get("cdn:hosts");
}

// This stuff never changes
var troupeEnv = {
  domain: nconf.get('web:domain'),
  baseServer: nconf.get('web:baseserver'),
  basePath: nconf.get('web:basepath'),
  apiBasePath: nconf.get('web:apiBasePath'),
  homeUrl: nconf.get('web:homeurl'),
  badgeBaseUrl: nconf.get('web:badgeBaseUrl'),
  embedBaseUrl: nconf.get('web:embedBaseUrl'),
  mixpanelToken: nconf.get("stats:mixpanel:enabled") && nconf.get("stats:mixpanel:token"),
  googleTrackingId: nconf.get("stats:ga:key"),
  googleTrackingDomain: nconf.get("stats:ga:domain"),
  goSquaredTrackingId: nconf.get("web:goSquaredId"),
  env: env,
  cdns: cdns,
  version: appVersion.getVersion(),
  assetTag: appVersion.getAssetTag(),
  logging: nconf.get("web:consoleLogging"),
  ravenUrl: nconf.get("errorReporting:clientRavenUrl"),
  websockets: {
    fayeUrl: nconf.get('ws:fayeUrl'),
    options: {
      timeout: nconf.get('ws:fayeTimeout'),
      retry: nconf.get('ws:fayeRetry')
    }
  },
  embed: {
    basepath: nconf.get('embed:basepath'),
    cacheBuster: nconf.get('embed:cacheBuster')
  },
  billingUrl: nconf.get('web:billingBaseUrl'),
  maxFreeOrgRoomMembers: nconf.get('maxFreeOrgRoomMembers')
};

exports.cdn = function(url, parameters) {
  return cdn(url, parameters ? parameters.hash:null);
};

function cdnUrlGenerator(url, options) {
  if(options.root) {
    return options.root + url;
  }

  return cdn(url, {});
}

exports.bootScript = function(url, parameters) {
  var options = parameters.hash;

  var baseUrl = cdnUrlGenerator("js/", options);
  var vendorScriptUrl = cdnUrlGenerator("js/vendor.js", options);
  var bootScriptUrl = cdnUrlGenerator("js/" + url + ".js", options);

  return util.format(
         "<script type='text/javascript'>window.webpackPublicPath = '%s';</script>" +
         "<script type='text/javascript' src='%s'></script>" +
         "<script type='text/javascript' src='%s'></script>",
         baseUrl,
         vendorScriptUrl,
         bootScriptUrl);
};

exports.isMobile = function(agent, options) {
  if (!agent) return false;
  return ((agent.match(/ipad/i)) ? options.fn(this) : null);
};

function createEnv(context, options) {
  if(options) {
    return _.extend({
      lang: context.lang
    }, troupeEnv, options);
  }
  return troupeEnv;
}
exports.generateEnv = function(parameters) {
  var options = parameters.hash;
  var env = createEnv(this, options);

  return '<script type="text/javascript">' +
          'window.troupeEnv = ' + safeJson(JSON.stringify(env)) + ';' +
          '</script>';
};

exports.generateTroupeContext = function(troupeContext, parameters) {
  var options = parameters.hash;

  var env = createEnv(this, options);

  return '<script type="text/javascript">' +
          'window.troupeEnv = ' + safeJson(JSON.stringify(env)) + ';' +
          'window.troupeContext = ' + safeJson(JSON.stringify(troupeContext)) + ';' +
          '</script>';
};

// credit to @lazd (https://github.com/lazd) - https://github.com/wycats/handlebars.js/issues/249
exports.pluralize = function(number, singular, plural) {
  if (number === 1) return singular;
  return (typeof plural === 'string') ? plural : singular + 's';
};

exports.toLowerCase = function (str) {
  return str.toLowerCase();
};

exports.pad = function(options) {
  var content = "" + options.fn(this);
  var width = options.hash.width || 40;
  var directionRight = options.hash.direction ? options.hash.direction == "right" : true;

  while (content.length < width) {
    if (directionRight) {
      content+=" ";
    } else  {
      content=" " + content;
    }
  }
  return content;
};

exports.oneLine = function(options) {
  var content = "" + options.fn(this);
  content=content.replace(/\n/g,"");
  return content;
};

// FIXME REMOVE THIS ONCE THE NEW ERRORS PAGES ARE DONE
exports.typewriter = function (el, str) {
  return util.format('<script type="text/javascript">\n' +
    'var text = "%s";' +
    'var input = $("%s");' +
    'input.select();' +
    'setTimeout(startTyping, 1000, input, text);' +
    'function startTyping(input, text) {' +
      'for ( var i = 0; i < text.length; i++ ) {' +
        'setTimeout(addText,120*i, input, text.charAt(i));' +
      '}' +
    '}' +
    'function addText(i,c) {' +
      'if (c !== "-") i.val( i.val() + c );' +
    '}' +
  '</script>',
    str,
    el);
};

exports.formatNumber = function (n) {
  if (n < 1000) return n;
  if (n < 1000000) return (n / 1000).toFixed(1) + 'k';
  return (n / 100000).toFixed(1) + 'm';
};

/** FIXME we do not yet cover the ONE-TO-ONE case, also need to do better default values
 * githubTypeToClass() takes a GitHub type and provdides a css class
 *
 */
exports.githubTypeToClass = function (type) {
  if (/_CHANNEL/.test(type)) return 'icon-hash';
  else if (/REPO/.test(type)) return 'octicon-repo';
  else if (/ORG/.test(type)) return 'octicon-organization';
  else return 'default';
};

exports.getRoomName = function (name) {
  return name.split('/')[1] || 'general';
};
