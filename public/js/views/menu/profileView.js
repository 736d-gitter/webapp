"use strict";
var context = require('utils/context');
var Marionette = require('marionette');
var appEvents = require('utils/appevents');
var isMobile = require('utils/is-mobile');
var isNative = require('utils/is-native');
var template = require('./tmpl/profile.hbs');
require('views/behaviors/widgets');

module.exports = (function () {

  return Marionette.ItemView.extend({
    template: template,

    events: {
      "click #link-home": 'homeClicked'
    },

    behaviors: {
      Widgets: {}
    },

    initialize: function (options) {
      this.state = options.state;
      this.listenTo(this.state, 'change', this.render);
      this.render();
    },

    serializeData: function () {
      var user = context.getUser();
      var userModel = context.user();

      var isMobileResult = isMobile();
      var isNativeResult = isNative();

      return {
        expanded: this.state.get('expanded'),
        displayName: user.displayName || user.username,
        user: userModel,
        billingUrl: context.env('billingUrl'),
        showBilling: !isMobileResult,
        showGetApps: !isMobileResult && !isNativeResult,
        showSignout: !isNativeResult
      };
    },

    homeClicked: function (e) {
      e.preventDefault();
      if (context().user.url !== window.location.pathname) {
        appEvents.trigger('navigation', context.getUser().url, 'home', '');
      }
    }
  });

})();

