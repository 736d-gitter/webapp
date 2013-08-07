/*jshint globalstrict: true, trailing: false, unused: true, node: true */
"use strict";

var nconf = require('../utils/config');
var cdn = require("./cdn");

var minifiedDefault = nconf.get("web:minified");

exports.cdn = function(url, parameters) {
  return cdn(url, parameters ? parameters.hash:null);
};

exports.bootScript = function(url, parameters) {
  var options = parameters.hash;

  var requireScript;
  var cdn      = (options.skipCdn) ? function(a) { return '/' + a; } : exports.cdn;
  var skipCore = options.skipCore;
  var minified = 'minified' in options ? options.minified : minifiedDefault;

  var baseUrl = cdn("js/");

  if(minified) {
    if(skipCore) {
      requireScript = cdn("js/" + url + ".min.js");
    } else {
      url = url + ".min";
      // note: when the skipCdn flag was introduced it affected this even though this isn't the file that was requested in this invocation
      requireScript = cdn("js/core-libraries.min.js");
    }

    return "<script type='text/javascript'>\nwindow.require_config.baseUrl = '" + baseUrl + "';</script>\n" +
            "<script defer='defer' async='true' data-main='" + url + "' src='" + requireScript + "' type='text/javascript'></script>\n";

  }

  requireScript = cdn("repo/requirejs/requirejs.js");

  return "<script type='text/javascript'>window.require_config.baseUrl = '" + baseUrl + "';</script>\n" +
         "<script defer='defer' async='true' data-main='" + url + ".js' src='" + requireScript + "' type='text/javascript'></script>";

};

exports.isMobile = function(agent, options) {
  return ((agent.match(/ipad/i)) ? options.fn(this) : null);
};
