"use strict";

var Marionette = require('backbone.marionette');
var ModalView = require('./modal');
var template = require('./tmpl/login-view.hbs');

require('gitter-styleguide/css/components/buttons.css');


var View = Marionette.ItemView.extend({
  template: template,
  className: 'login-view',

  initialize: function(options) {
    options = options || {};

    // these are mixpanel variables that we have to pass on
    this.action = options.action || '';
    this.source = options.source || '';
    this.returnTo = options.returnTo || '';

    this.listenTo(this, 'menuItemClicked', this.menuItemClicked);
  },

  menuItemClicked: function(button) {
    switch (button) {
      case 'cancel':
        this.dialog.hide();
        break;
    }
  },

  serializeData: function() {
    return {
      action: this.action,
      source: this.source,
      returnTo: this.returnTo,
      // TODO: remove this and just show it anyway
      showTwitter: true
    }
  }
});

var Modal = ModalView.extend({
  initialize: function(options) {
    options = options || {};
    options.modalClassVariation = 'modal--default__narrow';

    ModalView.prototype.initialize.call(this, options);
    this.view = new View(options);
  }
});

module.exports = Modal;
