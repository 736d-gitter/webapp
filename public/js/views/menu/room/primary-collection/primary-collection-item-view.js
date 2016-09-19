'use strict';

var Backbone = require('backbone');
var _ = require('underscore');
var itemTemplate = require('./primary-collection-item-view.hbs');
var apiClient = require('../../../../components/api-client');
var context = require('../../../../utils/context');
var appEvents = require('../../../../utils/appevents');
var parseForTemplate = require('gitter-web-shared/parse/left-menu-primary-item');
var toggleClass = require('../../../../utils/toggle-class');
var parseRoomItemName = require('gitter-web-shared/get-org-menu-state-name-from-troupe-name');
var roomNameShortener = require('gitter-web-shared/room-name-shortener');

var BaseCollectionItemView = require('../base-collection/base-collection-item-view');

module.exports = BaseCollectionItemView.extend({

  template: itemTemplate,

  modelEvents: _.extend({}, BaseCollectionItemView.prototype.modelEvents, {
    'change:favourite': 'onFavouriteChange',
  }),
  events: {
    'click #room-item-options-toggle': 'onOptionsClicked',
    'click #room-item-hide':           'onHideClicked',
    'click #room-item-leave':          'onLeaveClicked',
    mouseleave:                        'onMouseOut',

    // Note this probably won't get triggered because we listen to clicks on
    // the wrapper but better safe than sorry
    click: 'onClick'
  },

  className: null,
  attributes: function() {
    var id = this.model.get('id');
    return {
      class:     (this.model.get('githubType') === 'ONETOONE') ? 'room-item--one2one' : 'room-item',
      'data-id': id,
      id:        id,
    };
  },

  initialize: function() {
    BaseCollectionItemView.prototype.initialize.apply(this, arguments);

    this.uiModel = new Backbone.Model({ menuIsOpen: false });
    this.listenTo(this.uiModel, 'change:menuIsOpen', this.onModelToggleMenu, this);
    this.listenTo(this.roomMenuModel, 'change:state:post', this.onMenuChangeState, this);
  },

  serializeData: function() {
    var data = parseForTemplate(this.model.toJSON(), this.roomMenuModel.get('state'));

    //When the user is viewing a room he is lurking in and activity occurs
    //we explicitly, in this case, cancel the lurk activity
    //this would be a lot easier (as with a lot of things) if we persisted activity on the server JP 17/3/16
    if (data.lurkActivity && (data.id === context.troupe().get('id'))) {
      data.lurkActivity = false;
    }

    return data;
  },

  onOptionsClicked: function(e) {
    //Stop this view triggering up to the parent
    e.stopPropagation();

    //stop this view from triggering a click on the anchor
    e.preventDefault();
    if (this.roomMenuModel.get('state') === 'search') { return; }

    this.uiModel.set('menuIsOpen', !this.uiModel.get('menuIsOpen'));
  },

  onModelToggleMenu: function(model, val) {// jshint unused: true
    toggleClass(this.el, 'active', val);
  },

  onMouseOut: function() {
    this.uiModel.set('menuIsOpen', false);
  },

  onClick: function(e) {
    e.preventDefault();
  },

  //This is overly complex but that's where we are today...
  onFavouriteChange: function (model) {
    if (model.get('oneToOne')) {
      if (model.get('favourite')) {
        this.el.classList.remove('room-item--one2one');
        this.el.classList.add('room-item--favourite-one2one');
      } else {
        this.el.classList.add('room-item--one2one');
        this.el.classList.remove('room-item--favourite-one2one');
      }
    } else {
      if (model.get('favourite')) {
        this.el.classList.remove('room-item');
        this.el.classList.add('room-item--favourite');
      } else {
        this.el.classList.add('room-item');
        this.el.classList.remove('room-item--favourite');
      }
    }
  },

  onHideClicked: function(e) {
    e.stopPropagation();

    // Hide the room in the UI immediately
    this.model.set('lastAccessTime', null);

    //TODO figure out why this throws an error.
    //implementation is exactly the same as on develop?
    //JP 13/1/16
    apiClient.user.delete('/rooms/' + this.model.id)
      .then(this.onHideComplete.bind(this))

      //TODO should this so some kind of visual error? JP
      .catch(this.onHideComplete.bind(this));
  },

  onHideComplete: function() {
    this.trigger('hide:complete');
  },

  onLeaveClicked: function(e) {
    e.stopPropagation();
    if (this.model.get('id') === context.getTroupeId()) {
      appEvents.trigger('about.to.leave.current.room');
    }

    apiClient.delete('/v1/rooms/' + this.model.get('id') + '/users/' + context.getUserId())
      .then(function() {
        this.trigger('leave:complete');
      }.bind(this));
  },

  render: function() {
    //TODO Figure out why there is soooo much rendering JP 5/2/16
    if (!Object.keys(this.model.changed)) { return; }

    // Using call since render never has any arguments and `.call` is much faster
    BaseCollectionItemView.prototype.render.call(this);
  },

  onRender: function (){
    BaseCollectionItemView.prototype.onRender.apply(this, arguments);
    //The favourite item view overrides this function so here we can be 100%
    //sure this only runs for a primary item, as such we can just remove any favourite styles
    //here jp 17/5/16
    this.el.classList.remove('room-item--favourite');
    this.el.classList.remove('room-item--favourite-one2one');

    if (this.model.get('oneToOne')) {
      this.el.classList.add('room-item--one2one');
    }
    else {
      this.el.classList.add('room-item');
    }

  },

  onDestroy: function() {
    this.stopListening(this.uiModel);
  },

  onMenuChangeState: function () {
    var data = parseForTemplate(this.model.toJSON(), this.roomMenuModel.get('state'));

    if(data.namePieces) {
      // If we don't want to re-render, then we need to duplicate this template logic
      this.ui.title.html(data.namePieces.reduce(function(html, piece) { return html + '<span class="room-item__title-piece">' + piece + '</span>'; }, ''));
    }
    else {
      this.ui.title.html('<span class="room-item__title-piece">' + data.displayName || data.name + '</span>');
    }
  },
});
