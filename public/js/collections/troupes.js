/*jshint strict:true, undef:true, unused:strict, browser:true *//* global define:false */
define([
  'backbone',
  'utils/context',
  './base',
  '../utils/momentWrapper'
], function(Backbone, context, TroupeCollections, moment) {
  "use strict";

  var exports = {};
  exports.TroupeModel = TroupeCollections.Model.extend({
    idAttribute: "id",
    parse: function(message) {
      if(message.lastAccessTime) {
        message.lastAccessTime = moment(message.lastAccessTime, moment.defaultFormat);
      }

      return message;
    }
  }, { modelType: 'troupe' });

  exports.TroupeCollection = TroupeCollections.LiveCollection.extend({
    model: exports.TroupeModel,
    preloadKey: "troupes",
    initialize: function() {
      this.url = "/user/" + context.getUserId() + "/troupes";
    }
  });

  return exports;
});
