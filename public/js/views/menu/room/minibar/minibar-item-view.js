'use strict';

var _                 = require('underscore');
var Marionette        = require('backbone.marionette');
var itemTemplate      = require('./minibar-item-view.hbs');
var resolveRoomAvatar = require('gitter-web-shared/avatars/resolve-room-avatar-srcset');
var toggleClass       = require('utils/toggle-class');

module.exports =  Marionette.ItemView.extend({
  tagName: 'li',
  template: itemTemplate,

  ui: {
    minibarButton: '.room-menu-options__item-button'
  },

  behaviors: {
    Tooltip: {
      '.room-menu-options__item-button': { placement: 'right' }
    }
  },

  modelEvents: {
    'change:unreadItems change:mentions change:activity': 'render',
    'change:active': 'onActiveStateUpdate',
  },
  events: {
    'click': 'onItemClicked',
  },
  attributes: function() {
    var type = this.model.get('type');

    //account for initial render
    var className = 'room-menu-options__item--' + type;
    if (this.model.get('active')) { className = className += ' active'; }
    var id = (type === 'org') ? this.model.get('name') : type;

    return {
      'class':             className,
      'data-state-change': type,
      id:                  'minibar-' + id
    };
  },

  serializeData: function() {
    var data = this.model.toJSON();
    var activity = (data.mentions || data.unreadItems) ? false : data.activity;
    return _.extend({}, data, {
      isHome:       (data.type === 'all'),
      isSearch:     (data.type === 'search'),
      isFavourite:  (data.type === 'favourite'),
      isPeople:     (data.type === 'people'),
      isOrg:        (data.type === 'org'),
      avatarSrcset: resolveRoomAvatar({ uri: data.name }, 23),
      activity:     activity,
    });
  },

  onItemClicked: function() {
    this.trigger('minibar-item:clicked', this.model);
  },

  onActiveStateUpdate: function(model, val) { //jshint unused: true
    toggleClass(this.el, 'active', !!val);
  },

  onRender: function() {
    toggleClass(this.el, 'active', !!this.model.get('active'));
  },

});
