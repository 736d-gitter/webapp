'use strict';

var Marionette = require('backbone.marionette');
var template   = require('./footer-view.hbs');
var RAF        = require('utils/raf');

require('gitter-styleguide/css/components/buttons.css');

module.exports = Marionette.ItemView.extend({
  template: template,

  modelEvents: {
    'change:state': 'onModelChange',
  },

  ui: {
    searchFooter: '#panel-footer--search',
    allFooter: '#panel-footer--all'
  },

  initialize: function(attrs) {
    if (!attrs || !attrs.bus) {
      throw new Error('A valid event bus must be passed to a new instance of PanelFooterView');
    }

    this.bus = attrs.bus;
  },

  onModelChange: function(model, val) {//jshint unused: true
    RAF(function(){
      this.ui.searchFooter.toggleClass('active', (val === 'search'));
      this.ui.allFooter.toggleClass('active', (val !== 'search'));
    }.bind(this));
  },

});
