"use strict";
var Marionette = require('backbone.marionette');
var Backbone = require('backbone');
var getUserAvatarForSize = require('gitter-web-shared/avatars/get-user-avatar-for-size');
var Popover = require('views/popover');
var template = require('./tmpl/userPopoverView.hbs');
var footerTemplate = require('./tmpl/userPopoverFooterView.hbs');
var appEvents = require('utils/appevents');
var context = require('utils/context');
var SyncMixin = require('collections/sync-mixin');

module.exports = (function() {

  var UserView = Marionette.ItemView.extend({
    template: template,
    modelEvents: {
        'change': 'render',
    },
    serializeData: function() {
      var data = this.model.toJSON();

      if(data.blog) {
        if(!data.blog.match(/^https?:\/\//)) {
          data.blogUrl = 'http://' + data.blog;
        } else {
          data.blogUrl = data.blog;
        }
      }
      data.inactive = data.invited || data.removed;
      // TODO: send more than just a username
      data.avatarUrl = getUserAvatarForSize({ username: data.login }, 128);

      return data;
    }
  });

  var UserPopoverFooterView = Marionette.ItemView.extend({
    template: footerTemplate,
    modelEvents: {
        'change': 'render',
    },
    events: {
      'click #button-onetoone': function() {
        this.parentPopover.hide();
        var username = this.model.get('login');
        appEvents.trigger('navigation', '/' + username, 'chat', username, this.model.id);
      },
      'click #button-mention': function() {
        this.parentPopover.hide();
        var username = this.model.get('login');
        appEvents.trigger('input.append', '@' + username + " ");
      },
      'click #button-remove': function() {
        this.parentPopover.hide();
        var username = this.model.get('login');
        appEvents.trigger('command.room.remove', username);
      }
    },
    serializeData: function() {
      var data = this.model.toJSON();
      var isntSelf = data.login !== context.user().get('username');
      var chatPrivately = data.has_gitter_login && isntSelf;
      var mentionable = isntSelf;
      var removable = isntSelf && context.isTroupeAdmin();

      // Special case
      if(context.inOneToOneTroupeContext()) {
        if(context.troupe().get('user').username === data.login) {
          chatPrivately = false;
        }
      }

      data.inactive = data.invited || data.removed;
      data.chatPrivately = chatPrivately;
      data.mentionable = mentionable;
      data.removable = removable;
      return data;
    }

  });

  var UserPopoverView = Popover.extend({
    initialize: function(options) {
      options.placement = 'horizontal';
      options.minHeight = '88px';
      var username, displayName;

      if (this.model) {
        username = this.model.get('username');
        displayName = this.model.get('displayName'); // leave those in, optimistic loading.
      } else {
        username = options.username;
        displayName = options.displayName; // leave those in, optimistic loading.
      }

      var ghModel = new Backbone.Model({
        login: username,
        name: displayName
      });
      ghModel.sync = SyncMixin.sync; // XXX This is less than ideal
      ghModel.url = '/private/gh/users/' + username;
      ghModel.fetch();

      options.footerView = new UserPopoverFooterView({ model: ghModel });

      Popover.prototype.initialize.apply(this, arguments);
      this.view = new UserView({ model: ghModel, userCollection: options.userCollection });
    }
  });

  return UserPopoverView;

})();
