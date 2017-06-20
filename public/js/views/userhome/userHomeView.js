"use strict";
var $ = require('jquery');
var Marionette = require('backbone.marionette');
var context = require('utils/context');
var troupeCollections = require('collections/instances/troupes');
var SuggestedRoomsCollection = require('collections/suggested-rooms');
var userHomeTemplate = require('./tmpl/userHomeTemplate.hbs');
var OrgCollectionView = require('./homeOrgCollectionView');
var SuggestedCollectionView = require('./suggested-room-collection-view');
var isMobile = require('utils/is-mobile');
require('views/behaviors/isomorphic');

module.exports = (function() {

  return Marionette.LayoutView.extend({
    template: userHomeTemplate,
    tagName: 'div',

    events: {
      'click #upgrade-auth': 'onUpgradeAuthClick',
    },

    behaviors: {
      Isomorphic: {
        orgs: { el: "#org-list", init: 'initOrgsRegion' },
        suggestedRooms: { el: "#suggested-room-list", init: 'initSuggestedRoomsRegion' },
      }
    },

    initOrgsRegion: function(optionsForRegion) {
      return new OrgCollectionView(optionsForRegion({ collection: troupeCollections.orgs }));
    },

    initSuggestedRoomsRegion: function(optionsForRegion) {
      var suggestedRoomCollection = new SuggestedRoomsCollection();
      suggestedRoomCollection.fetchForUser();

      return new SuggestedCollectionView(optionsForRegion({ collection: suggestedRoomCollection }));
    },

    onRender: function() {
      $('#header-wrapper').hide(); // Why?
    },

    getUserTimestamp: function(id) {
      return new Date(parseInt(id.toString().slice(0,8), 16)*1000);
    },

    serializeData: function() {
      var user = context.getUser();
      var hasPrivateRepoScope = !!user.scopes.private_repo;

      return {
        basePath: context.env('basePath'),
        showUpgradeAuthLink: !isMobile() && !hasPrivateRepoScope
      };
    },

    onUpgradeAuthClick: function(e) {
      var target = e.target.href;

      window.addEventListener("message", function(event) {
        if(event.data === 'oauth_upgrade_complete') {
          window.location.reload(true);
        }
      }, false);

      window.open(target);
      e.preventDefault();
    }

  });


})();
