/*jshint globalstrict: true, trailing: false, unused: true, node: true */
"use strict";

var winston    = require('../utils/winston');
var nconf      = require('../utils/config');
var path       = require('path');
var handlebars = require('consolidate').handlebars;
var _          = require('underscore');
var widgetHelpers = require('./widget-prerenderers');

var HELPERS = _.extend(widgetHelpers, {
  'pluralize': require('./hbs-helpers').pluralize,
  'prerenderRoomListItem': require('./prerender-room-item-helper'),
  'prerenderOrgListItem': require('./prerender-org-item-helper'),
});

var baseDir = path.normalize(__dirname + '/../../' + nconf.get('web:staticContent') + '/');

module.exports = exports = function (template, callback) {
  handlebars(baseDir + template + '.hbs', _.extend({}, this, { helpers: HELPERS, cache: nconf.get('web:cacheTemplates') }), function (err, result) {
    if (err) {
      winston.error("Unable to prerender: " + err, { exception: err });
      return callback("");
    }

    callback(result);
  });
};
