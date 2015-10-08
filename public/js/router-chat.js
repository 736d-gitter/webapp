'use strict';
require('utils/initial-setup');

var Backbone               = require('backbone');
var context                = require('utils/context');
var liveContext            = require('components/live-context');
var appEvents              = require('utils/appevents');
var debug                  = require('debug-proxy')('app:router-chat');
var ChatToolbarInputLayout = require('views/layouts/chat-toolbar-input');
var DropTargetView         = require('views/app/dropTargetView');
var onready                = require('./utils/onready');
var apiClient              = require('components/apiClient');
var frameUtils             = require('./utils/frame-utils');
var itemCollections        = require('collections/instances/integrated-items');

/* Set the timezone cookie */
require('components/timezone-cookie');

require('components/statsc');
require('views/widgets/preload');
require('filtered-collection');
require('components/dozy');
require('template/helpers/all');
require('components/eyeballs');
require('components/bug-reporting');
require('components/focus-events');

// Preload widgets
require('components/ping');

onready(function() {

  appEvents.on('navigation', function(url, type, title) {
    if (frameUtils.hasParentFrameSameOrigin()) {
      frameUtils.postMessage({ type: 'navigation', url: url, urlType: type, title: title});
    } else {
      // No pushState here. Open the link directly
      // Remember that (window.parent === window) when there is no parent frame
      window.parent.location.href = url;
    }
  });

  require('components/link-handler').installLinkHandler();

  window.addEventListener('message', function(e) {
    if (e.origin !== context.env('basePath')) {
      debug('Ignoring message from ' + e.origin);
      return;
    }

    var message;
    try {
      message = JSON.parse(e.data);
    } catch (err) {
      /* It seems as through chrome extensions use this event to pass messages too. Ignore them. */
      return;
    }

    debug('Received message %j', message);

    var makeEvent = function(message) {
      var origin = 'app';
      if (message.event && message.event.origin) origin = message.event.origin;
      message.event = {
        origin: origin,
        preventDefault: function() {
        },

        stopPropagation: function() {
        },

        stopImmediatePropagation: function() {
        },
      };
    };

    switch (message.type) {
      case 'keyboard':
        makeEvent(message);
        appEvents.trigger('keyboard.' + message.name, message.event, message.handler);
        appEvents.trigger('keyboard.all', message.name, message.event, message.handler);
      break;

      case 'focus':
        makeEvent(message);
        appEvents.trigger('focus.request.' + message.focus, message.event);
      break;

      case 'permalink.navigate':
        var query = message.query;
        /* Only supports at for now..... */
        var aroundId = query && query.at;

        if (aroundId) {
          appEvents.trigger('chatCollectionView:permalinkHighlight', aroundId);
        }

      break;

      case 'change:room':
        //destroy any modal views
        appView.dialogRegion.destroy();

        //set the context troupe to new troupe
        context.setTroupe(message.newTroupe);

        if (message.permalinkChatId) {
          appEvents.trigger('chatCollectionView:permalinkHighlight', message.permalinkChatId);
        }
      break;

      case 'about.to.leave.current.room':
        context.troupe().set('aboutToLeave', true);

      break;
    }
  });

  frameUtils.postMessage({ type: 'context.troupeId', troupeId: context.getTroupeId(), name: context.troupe().get('name') });

  appEvents.on('route', function(hash) {
    frameUtils.postMessage({ type: 'route', hash: hash });
  });

  appEvents.on('permalink.requested', function(type, chat, options) {
    if (context.inOneToOneTroupeContext()) return; // No permalinks to one-to-one chats
    var url = context.troupe().get('url');
    var id = chat.id;

    if (options && options.appendInput) {
      var fullUrl = context.env('basePath') + url + '?at=' + id;
      var formattedDate = chat.get('sent') && chat.get('sent').format('LLL');
      appEvents.trigger('input.append', ':point_up: [' + formattedDate + '](' + fullUrl + ')');
    }

    frameUtils.postMessage({ type: 'permalink.requested', url: url, permalinkType: type, id: id });
  });

  appEvents.on('realtime.testConnection', function(reason) {
    frameUtils.postMessage({ type: 'realtime.testConnection', reason: reason });
  });

  appEvents.on('realtime:newConnectionEstablished', function() {
    frameUtils.postMessage({ type: 'realtime.testConnection', reason: 'newConnection' });
  });

  appEvents.on('unreadItemsCount', function(newCount) {
    frameUtils.postMessage({ type: 'unreadItemsCount', count: newCount, troupeId: context.getTroupeId() });
  });

  // Bubble keyboard events
  appEvents.on('keyboard.all', function(name, event, handler) {
    // Don't send back events coming from the app frame
    if (event.origin && event.origin === 'app') return;
    var message = {
      type: 'keyboard',
      name: name,

      // JSON serialisation makes it not possible to send the event object
      // Keep track of the origin in case of return
      event: {origin: event.origin},
      handler: handler,
    };
    frameUtils.postMessage(message);
  });

  // Bubble chat toggle events
  appEvents.on('chat.edit.show', function() {
    frameUtils.postMessage({type: 'chat.edit.show'});
  });

  appEvents.on('chat.edit.hide', function() {
    frameUtils.postMessage({type: 'chat.edit.hide'});
  });

  // Send focus events to app frame
  appEvents.on('focus.request.app.in', function(event) {
    frameUtils.postMessage({type: 'focus', focus: 'in', event: event});
  });

  appEvents.on('focus.request.app.out', function(event) {
    frameUtils.postMessage({type: 'focus', focus: 'out', event: event});
  });

  appEvents.on('ajaxError', function() {
    frameUtils.postMessage({ type: 'ajaxError' });
  });

  var notifyRemoveError = function(message) {
    appEvents.triggerParent('user_notification', {
      title: 'Failed to remove user',
      text: message,
      className: 'notification-error',
    });
  };

  appEvents.on('command.room.remove', function(username) {
    if (!username) return;

    apiClient.room.delete('/users/' + username + '?type=username', '')
    .fail(function(xhr) {
      if (xhr.status < 500) notifyRemoveError(xhr.responseJSON.error);
      else notifyRemoveError('');
    });
  });

  var appView = new ChatToolbarInputLayout({ model: context.troupe(), template: false, el: 'body', chatCollection: itemCollections.chats });
  appView.render();

  /* Drag and drop */
  new DropTargetView({ template: false, el: 'body' }).render();

  var Router = Backbone.Router.extend({
    routes: {
      '': 'hideModal',
      'share': 'share',
      'delete': 'delete',
      'people': 'people',
      'notifications': 'notifications',
      'markdown': 'markdown',
      'keys': 'keys',
      'integrations': 'integrations',
      'add': 'addPeople',
      'tags/:roomId': 'editTags',
      'autojoin': 'autojoin'
    },

    autojoin: function() {
      apiClient.post('/v1/rooms/' + context.getTroupeId() + '/users', {username: context().user.username})
      .then(function(res) {
        //location.reload();
        context.troupe().set('roomMember', true);
      });
    },

    hideModal: function() {
      appView.dialogRegion.destroy();
    },

    people: function() {
      require.ensure(['views/modals/people-modal'], function(require) {
        var PeopleModal = require('views/modals/people-modal');

        appView.dialogRegion.show(new PeopleModal());
      });
    },

    notifications: function() {
      require.ensure(['views/app/troupeSettingsView'], function(require) {
        var TroupeSettingsView = require('views/app/troupeSettingsView');
        appView.dialogRegion.show(new TroupeSettingsView({}));
      });
    },

    markdown: function() {
      require.ensure(['views/modals/markdown-view'], function(require) {
        var MarkdownView = require('views/modals/markdown-view');
        appView.dialogRegion.show(new MarkdownView({}));
      });
    },

    keys: function() {
      require.ensure(['views/modals/keyboard-view'], function(require) {
        var KeyboardView = require('views/modals/keyboard-view');
        appView.dialogRegion.show(new KeyboardView({}));
      });
    },

    addPeople: function() {
      require.ensure(['views/app/addPeopleView', 'views/app/upgradeToProView'], function(require) {
        var room = context.troupe();
        var maxFreeMembers = context.env('maxFreeOrgRoomMembers');
        var isOverLimit = room.get('security') !== 'PUBLIC' &&
          room.get('githubType').indexOf('ORG') >= 0 &&
          !room.get('premium') &&
          room.get('userCount') >= maxFreeMembers;

        if (isOverLimit) {
          var GetProViewModal = require('views/app/upgradeToProView');
          appView.dialogRegion.show(new GetProViewModal({}));
        } else {
          var AddPeopleViewModal = require('views/app/addPeopleView');
          appView.dialogRegion.show(new AddPeopleViewModal({}));
        }
      });

    },

    editTags: function() {
      require.ensure(['views/app/editTagsView'], function(require) {
        var EditTagsView = require('views/app/editTagsView');
        appView.dialogRegion.show(new EditTagsView({roomId: context.troupe().get('id')}));
      });
    },

    integrations: function() {
      if (context.isTroupeAdmin()) {
        require.ensure(['views/app/integrationSettingsModal'], function(require) {
          var IntegrationSettingsModal = require('views/app/integrationSettingsModal');

          appView.dialogRegion.show(new IntegrationSettingsModal({}));
        });
      } else {
        window.location = '#';
      }
    },

    share: function() {
      require.ensure(['views/share/share-view'], function(require) {
        var shareView = require('views/share/share-view');

        appView.dialogRegion.show(new shareView.Modal({}));
      });
    },

    delete: function() {
      require.ensure(['views/menu/delete-room-modal'], function(require) {
        var DeleteModal = require('views/menu/delete-room-modal');

        appView.dialogRegion.show(new DeleteModal({}));
      });
    },

  });

  var router = new Router();

  var showingHelp = false;
  var hideHelp = function() {
    router.navigate('', {trigger: true});
    showingHelp = false;
  };

  appEvents.on('keyboard.help.markdown', function(event) {
    if (showingHelp === 'markdown') hideHelp();
    else {
      appEvents.trigger('focus.request.out', event);
      router.navigate('markdown', {trigger: true});
      showingHelp = 'markdown';
    }
  });

  appEvents.on('keyboard.help.keyboard', function(event) {
    if (showingHelp === 'keys') hideHelp();
    else {
      appEvents.trigger('focus.request.out', event);
      router.navigate('keys', {trigger: true});
      showingHelp = 'keys';
    }
  });

  appEvents.on('keyboard.document.escape', function() {
    if (showingHelp) hideHelp();
  });

  // Listen for changes to the room
  liveContext.syncRoom();

  Backbone.history.start();
});
