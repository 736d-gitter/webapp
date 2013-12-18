/*jshint strict:true, undef:true, unused:strict, browser:true *//* global define:false */
define([
  'utils/context',
  'views/base',
  'utils/appevents',
  'hbs!./tmpl/profile',
], function(context, TroupeViews, appEvents, template) {
  "use strict";

  return TroupeViews.Base.extend({
    template: template,
    events: {
      "click #link-home": 'homeClicked'
    },
    getRenderData: function() {
      var user = context.getUser();
      var userModel = context.user();
      return {
        displayName: user.displayName || user.username,
        user: userModel,
        username: user.username
      };
    },
    homeClicked: function(e) {
      e.preventDefault();
      appEvents.trigger('navigation', context.getUser().url, 'home', '', model.id); // TODO: figure out a title
    }
  });
});
