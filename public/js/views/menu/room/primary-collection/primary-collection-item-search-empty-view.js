'use strict';

var Marionette = require('backbone.marionette');
var template = require('./primary-collection-item-search-empty-view.hbs');

module.exports = Marionette.ItemView.extend({
  template: template
});
