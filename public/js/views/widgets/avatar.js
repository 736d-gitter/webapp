/*jshint strict:true, undef:true, unused:strict, browser:true *//* global define:false */
define([
  'jquery',
  'backbone',
  'underscore',
  'utils/context',
  'utils/safe-html',
  'views/base',
  'hbs!./tmpl/avatar',
  'views/people/userPopoverView',
  'bootstrap_tooltip',                // No ref
], function($, Backbone, _, context, safeHtml, TroupeViews, template, UserPopoverView) {

  "use strict";

  return TroupeViews.Base.extend({
    tagName: 'span',
    template: template,
    events: {
      'mouseover': 'showDetailIntent',
      'click':     'showDetail'
    },
    initialize: function(options) {
      var self = this;
      this.user = options.user ? options.user : {};
      this.showEmail = options.showEmail || {};
      this.showBadge = options.showBadge;
      this.showStatus = options.showStatus;
      this.avatarSize = options.size ? options.size : 's';
      this.showTooltip = options.showTooltip !== false;
      this.tooltipPlacement = options.tooltipPlacement || 'vertical';

      // once this widget has the id of the user,
      // it will listen to changes on the global user collection,
      // so that it knows when to update.
      var avatarChange = _.bind(function(event, user) {
        if(user.id !== self.getUserId()) return;

        if(self.user) {
          self.user = user;
        }

        // re-rendering every avatar when the presence changes is excessive, especially for the viewer's own avatars
        self.update();
      }, this);

      var isModel = !!this.model;
      if (isModel) {
        this.listenTo(this.model, 'change', function(model) {
          avatarChange({}, model);
        });
      } else {
        // Unfortunately we can't use listenTo with jquery events
        $(document).on('avatar:change', avatarChange);
        this.addCleanup(function() {
          $(document).off('avatar:change', avatarChange);
        });

      }
    },

    showDetailIntent: function(e) {
      UserPopoverView.hoverTimeout(e, function() {
        this.showDetail(e);
      }, this);
    },

    showDetail: function(e) {
      if (this.compactView) return;
      e.preventDefault();

      if(this.popover) return;

      this.$el.find(':first-child').tooltip('hide');

      var model = this.model || new Backbone.Model(this.user);
      var popover = new UserPopoverView({
        model: model,
        targetElement: e.target
      });

      popover.show();
      UserPopoverView.singleton(this, popover);
    },

    update: function() {
      var data = this.getRenderData();
      this.updatePresence(data);
      this.updateAvatar(data);
      this.updateTooltip(data);
    },

    updatePresence: function(data) {
      if (this.showStatus) {
        this.$el.find('.trpDisplayPicture').toggleClass('online', data.online);
        this.$el.find('.trpDisplayPicture').toggleClass('offline', !data.online);
      }
    },

    updateAvatar: function(data) {
      this.$el.find('.trpDisplayPicture').css({ 'background-image': "url('" + data.avatarUrl + "')" });
    },

    updateTooltip: function(data) {
      if(this.showTooltip) {
        this.$el.find('.trpDisplayPicture').attr('data-original-title', safeHtml(data.tooltip));
      }
    },

    getUserId: function() {
      if(this.model) return this.model.id;
      if(this.user) return this.user.id;
      return null;
    },

    getRenderData: function() {
      var currentUserId = context.getUserId();

      var user = this.model ? this.model.toJSON() : this.user;

      var avatarUrl;
      if (this.avatarSize == 'm') {
        avatarUrl = user.avatarUrlMedium || '/images/2/avatar-default-m.png';
      } else {
        avatarUrl = user.avatarUrlSmall || '/images/2/avatar-default-s.png';
      }

      var online = user.id === currentUserId || !!user.online; // only the people view tries to show avatar status so there is a model object, it won't necessarily work in other cases

      var presenceClass;
      if (this.showStatus) {
        presenceClass = online ? 'online' : 'offline';
      } else {
        presenceClass = "";
      }

      return {
        id: user.id,
        showBadge: this.showBadge,
        showStatus: this.showStatus,
        userDisplayName: user.displayName,
        avatarUrl: avatarUrl,
        avatarSize: this.avatarSize,
        showTooltip: this.showTooltip,
        presenceClass: presenceClass,
        online: online,
        offline: !online,
        role: user.role
      };
    },

    // TODO: use base classes render() method
    render: function() {
      var data = this.getRenderData();
      var dom = this.template(data);
      this.$el.html(dom);

      if (this.showTooltip && !window._troupeCompactView && (this.model ? this.model.get('displayName') : this.user.displayName)) {
        this.$el.find(':first-child').tooltip({
          html : true,
          placement : this.tooltipPlacement,
          container: "body"
        });
      }
      return this;
    }

  });

});
