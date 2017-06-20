'use strict';

var $             = require('jquery');
var Marionette    = require('backbone.marionette');
var RoomMenuModel = require('../../../../models/room-menu-model');
var MiniBarView   = require('../minibar/minibar-view');
var PanelView     = require('../panel/panel-view');
var context       = require('utils/context');
var DNDCtrl       = require('../../../../components/menu/room/dnd-controller');

var MENU_HIDE_DELAY = 200;

require('views/behaviors/isomorphic');

module.exports = Marionette.LayoutView.extend({

  behaviors: {
    Isomorphic: {
      minibar: { el: '#minibar', init: 'initMiniBar' },
      panel: { el: '#room-menu__panel', init: 'initMenuPanel' },
    },
  },

  initMiniBar: function(optionsForRegion) {
    return new MiniBarView(optionsForRegion({
      model: this.model,
      bus: this.bus,
      dndCtrl: this.dndCtrl,
    }));
  },

  initMenuPanel: function(optionsForRegion) {
    return new PanelView(optionsForRegion({
      model: this.model,
      bus: this.bus,
      dndCtrl: this.dndCtrl,
    }));
  },

  events: {
    'mouseenter': 'openPanel',
    'mouseleave': 'closePanel',
  },

  initialize: function(attrs) {

    //Event Bus
    if (!attrs || !attrs.bus) {
      throw new Error('A valid event bus needs to be passed to a new instance of RoomMenuLayout');
    }

    this.bus   = attrs.bus;

    //Room Collection
    if (!attrs || !attrs.roomCollection) {
      throw new Error('A valid room collection needs to be passed to a new instance of RoomMenyLayout');
    }

    this.roomCollection          = attrs.roomCollection;
    this.orgCollection           = attrs.orgCollection;
    this.suggestedRoomCollection = attrs.suggestedRoomCollection;

    //Menu Hide Delay
    this.delay = MENU_HIDE_DELAY;

    //Make a new model
    this.model =  new RoomMenuModel({
      bus:                     this.bus,
      roomCollection:          this.roomCollection,
      orgCollection:           this.orgCollection,
      userModel:               context.user(),
      suggestedRoomCollection: this.suggestedRoomCollection,

      //TODO id this the best way to do this? JP 12/1/16
      isMobile:                $('body').hasClass('mobile'),
    });

    //Make a new drag & drop control
    this.dndCtrl = new DNDCtrl({ model: this.model });

    this.listenTo(this.dndCtrl, 'dnd:start-drag', this.onDragStart.bind(this));
    this.listenTo(this.dndCtrl, 'dnd:end-drag', this.onDragEnd.bind(this));

    this.$el.find('#searc-results').show();
  },

  onDragStart: function() {
    this.model.set('roomMenuWasPinned', this.model.get('roomMenuIsPinned'));
    this.model.set('roomMenuIsPinned', true);
    this.openPanel();
  },

  onDragEnd: function() {
    if (!this.model.get('roomMenuWasPinned')) {
      this.model.set('roomMenuIsPinned', false);
    }

    this.openPanel();
  },

  openPanel: function() {
    if (this.model.get('roomMenuIsPinned')) { return; }

    this.model.set('panelOpenState', true);
    if (this.timeout) { clearTimeout(this.timeout); }
  },

  closePanel: function() {
    if (this.model.get('roomMenuIsPinned')) { return; }

    this.timeout = setTimeout(function() {
      this.model.set('panelOpenState', false);
    }.bind(this), this.delay);

  },

  onDestroy: function() {
    this.stopListening(this.dndCtrl);
  },

});
