"use strict";

var $ = require('jquery');
var Backbone = require('backbone');
var context = require('./utils/context');
var appEvents = require('./utils/appevents');
var onready = require('./utils/onready');

var chatModels = require('./collections/chat');
var troupeCollections = require('./collections/instances/troupes');
var presentCreateRoomDialog = require('./ensured/present-create-room-dialog');
var presentCreateCommunityDialog = require('./ensured/present-create-community-dialog');
var unreadItemsClient = require('./components/unread-items-client');
var RoomCollectionTracker = require('./components/room-collection-tracker');
var MobileLayout = require('./views/layouts/mobile');

//Remove when left menu is in place
var FastClick = require('fastclick');

//Left Menu Additions
//var gestures              = require('./utils/gesture-controller');

require('./utils/tracking');

/* Set the timezone cookie */
require('./components/timezone-cookie');

// Preload widgets
require('./views/widgets/avatar');
require('./components/ping');
require('./components/eyeballs-room-sync');
require('./template/helpers/all');
require('./utils/gesture-controller');

onready(function() {
  //Ledt Menu Additions
  //gestures.init();


  //Remove when left menu is in place
  FastClick.attach(document.body);

  require('./components/link-handler').installLinkHandler();
  appEvents.on('navigation', function(url) {
    window.location.href = url;
  });

  new RoomCollectionTracker(troupeCollections.troupes);

  var chatCollection = new chatModels.ChatCollection(null, { listen: true });

  unreadItemsClient.syncCollections({
    'chat': chatCollection
  });

  appEvents.on('route', function(fragment) {
    window.location.hash = '#' + fragment;
  });

  var appView = new MobileLayout({
    model: context.troupe(),
    template: false,
    el: 'body',
    chatCollection: chatCollection,
    //Left Menu Additions
    //roomCollection: troupeCollections.troupes
    orgCollection: troupeCollections.orgs,
    groupsCollection: troupeCollections.groups
  });
  appView.render();

  var Router = Backbone.Router.extend({
    routes: {
      "": "hideModal",
      "notifications": "notifications",
      'notification-defaults': 'notificationDefaults',
      'createroom': 'createRoom',
      'createroom/:name': 'createRoom',
      'createcommunity': 'createCommunity'
    },

    hideModal: function() {
      appView.dialogRegion.destroy();
    },

    notifications: function() {
      require.ensure(['./views/modals/notification-settings-view'], function(require) {
        var NotificationSettingsView = require('./views/modals/notification-settings-view');
        appView.dialogRegion.show(new NotificationSettingsView({ model: new Backbone.Model() }));
      });
    },

    notificationDefaults: function() {
      require.ensure(['./views/modals/notification-defaults-view'], function(require) {
        var NotificationDefaultsView = require('./views/modals/notification-defaults-view');

        appView.dialogRegion.show(new NotificationDefaultsView({
          model: new Backbone.Model()
        }));

      });
    },

    createRoom: function(initialRoomName) {
      presentCreateRoomDialog({
        dialogRegion: appView.dialogRegion,
        roomCollection: troupeCollections.troupes,
        groupsCollection: troupeCollections.groups,
        roomMenuModel: null,
        initialRoomName: initialRoomName
      });
    },

    createCommunity: function() {
      presentCreateCommunityDialog({
        dialogRegion: appView.dialogRegion
      });
    },
  });

  new Router();

  $('html').removeClass('loading');

  Backbone.history.start();
});
