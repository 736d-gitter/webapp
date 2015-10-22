"use strict";
var Backbone = require('backbone');
var Marionette = require('backbone.marionette');
var context = require('utils/context');
var template = require('./tmpl/avatar.hbs');
var UserPopoverView = require('views/people/userPopoverView');
var widgets = require('views/behaviors/widgets');
var getUserAvatarForSize = require('gitter-web-shared/avatars/get-user-avatar-for-size');
require('views/behaviors/tooltip');
var FastAttachMixin = require('views/fast-attach-mixin');


module.exports = (function() {

  var AvatarWidget = Marionette.ItemView.extend({
    tagName: 'div',
    className: 'avatar',
    template: template,
    events: {
      'mouseover': 'showDetailIntent',
      'click':     'showDetail'
    },
    ui: {
      tooltip: ':first-child',
      image: '.trpDisplayPicture'
    },
    modelEvents: {
      change: 'update'
    },
    behaviors: function() {
      var options = this.options;

      if (options.showTooltip !== false) {
        return {
          Tooltip: {
            ':first-child': { titleFn: 'getTooltip', placement: options.tooltipPlacement || 'vertical' },
          }
        };
      }
    },
    initialize: function (options) {
      if (options.user) {
        this.model = new Backbone.Model(options.user);
      }
      // // TODO: is it necessary to listen for updates to the invite status?
      //
      // this.user = options.user ? options.user : {};
      // this.showEmail = options.showEmail || {};
      // this.showBadge = options.showBadge;
      // this.showStatus = options.showStatus;
      // this.avatarSize = options.size ? options.size : 's';
    },

    showDetailIntent: function(e) {
      UserPopoverView.hoverTimeout(e, function() {
        this.showDetail(e);
      }, this);
    },

    showDetail: function(e) {
      e.preventDefault();

      if (this.popover) return;

      this.ui.tooltip.tooltip('hide');

      var model = this.model;
      var popover = new UserPopoverView({
        model: model,
        targetElement: e.target
      });

      popover.show();
      UserPopoverView.singleton(this, popover);
    },

    update: function () {
      var data = this.serializeData();
      this.updatePresence(data);
      this.updateAvatar(data);
    },

    updatePresence: function(data) {
      if (this.options.showStatus) {
        this.ui.image.toggleClass('online', data.online);
        this.ui.image.toggleClass('offline', !data.online);
      }
    },

    updateAvatar: function(data) {
      var newUrl = "url('" + data.avatarUrl + "')";
      if (newUrl !== this.ui.image.css('background-image')) {
        this.preloadImage(data.avatarUrl, function() {
          this.ui.image.css({ 'background-image': newUrl });
        });
      }
    },

    getUserId: function() {
      return this.model.id;
    },

    serializeData: function() {
      var options = this.options || {};
      var user = this.model && this.model.toJSON();
      return serializeData(user, options);
    },

    getTooltip: function() {
      return this.model.get('displayName');
    },

    preloadImage: function(url, callback) {
      var image = document.createElement('img');
      var self = this;

      image.onload = function() {
        if (self.isDestroyed) return;
        image.onload = null;
        callback.call(self);
      }

      image.onerror = function() {
        if (self.isDestroyed) return;
        image.onerror = null;
        callback.call(self);
      }

      image.src = url;
    },

    attachElContent: FastAttachMixin.attachElContent

  });

  function serializeData(user, options) {
    // This is overly complicated....
    // TODO: simplify the pre-rendering process
    if (!user) {
      if (options.model) {
        user = options.model.toJSON();
      } else {
        user = options.user || {};
      }
    }

    var currentUserId = context.getUserId();
    // NOTE: 60*2 doesn't map to avatarUrlSmall or avatarUrlMedium. It gets
    // displayed at 30 wide, so 60 makes sense for retina.
    var avatarUrl = getUserAvatarForSize(user, (options.avatarSize == 'm' ? 128 : 60));

    var online = user.id === currentUserId || !!user.online; // only the people view tries to show avatar status so there is a model object, it won't necessarily work in other cases

    var presenceClass;
    if (options.showStatus) {
      presenceClass = online ? 'online' : 'offline';
    } else {
      presenceClass = "";
    }

    return {
      id: user.id,
      showBadge: options.showBadge,
      showStatus: options.showStatus,
      userDisplayName: user.displayName,
      avatarUrl: avatarUrl,
      avatarSize: options.avatarSize || 's',
      presenceClass: presenceClass,
      online: online,
      offline: !online,
      role: user.role,
      invited: user.invited,
      removed: user.removed,
      inactive: user.removed || user.invited
    };
  }

  AvatarWidget.getPrerendered = function(model, id) {
    return "<span class='widget' data-widget-id='" + id + "'>" + template(serializeData(null, model)) + "</span>";
  };

  widgets.register({ avatar: AvatarWidget });
  return AvatarWidget;

})();
