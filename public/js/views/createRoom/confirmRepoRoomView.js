"use strict";
var Backbone = require('backbone');
var Marionette = require('backbone.marionette');
var apiClient = require('components/apiClient');
var appEvents = require('utils/appevents');
var ModalView = require('views/modal');
var template = require('./tmpl/confirmRepoRoom.hbs');

module.exports = (function() {


  var View = Marionette.ItemView.extend({
    template: template,

    modelEvents: {
      change: 'render'
    },

    ui: {
      'modalFailure': '#modal-failure',
      'addBadge': '.js-add-badge'
    },

    initialize: function(options) {
      var isOrg = options.uri.split('/').length === 1 ? true : false;
      this.model = new Backbone.Model({ uri: options.uri, isOrg: isOrg });
      this.listenTo(this, 'menuItemClicked', this.menuItemClicked);
    },

    menuItemClicked: function(button) {
      switch (button) {
        case 'create':
          this.createRoom();
          break;

        case 'cancel':
          this.dialog.hide();
          break;
      }
    },

    createRoom: function() {
      var self = this;
      var addBadge = this.ui.addBadge.prop('checked');

      self.ui.modalFailure.hide();
      var uri = self.model.get('uri');

      apiClient.post('/v1/rooms', { uri: uri, addBadge: addBadge })
        .then(function () {
          self.dialog.hide();
          appEvents.trigger('navigation', '/' + uri, 'chat', uri, null);
        })
        .fail(function (/*xhr*/) {
          self.model.set('error', 'Unable to create room');
          self.ui.modalFailure.show('fast');
          // Do something here.
        });
    }

  });

  var Modal = ModalView.extend({
    initialize: function(options) {
      options = options || {};
      options.title = options.title || "Create Room for " + options.uri;

      ModalView.prototype.initialize.call(this, options);
      this.view = new View(options);
    },
    menuItems: [
      { action: "cancel", text: "Cancel", className: "modal--default__footer__btn--negative"},
      { action: "create", text: "Create", className: "modal--default__footer__btn" },
    ]
  });

  return {
    View: View,
    Modal: Modal
  };


})();
