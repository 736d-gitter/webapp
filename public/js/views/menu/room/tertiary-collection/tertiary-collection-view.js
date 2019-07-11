'use strict';

var _ = require('lodash');
var urlJoin = require('url-join');
var Marionette = require('backbone.marionette');
var toggleClass = require('../../../../utils/toggle-class');
var BaseCollectionView = require('../base-collection/base-collection-view');
var BaseCollectionItemView = require('../base-collection/base-collection-item-view');
var EmptySearchView = require('./tertiary-collection-item-search-empty-view');
var parseForTemplate = require('gitter-web-shared/parse/left-menu-primary-item');

var proto = BaseCollectionView.prototype;

var ItemView = BaseCollectionItemView.extend({
  getRoomUrl: function() {
    var url = BaseCollectionItemView.prototype.getRoomUrl.apply(this, arguments);

    if (this.model.get('isSuggestion')) {
      url = urlJoin(url, '?source=suggested-menu');
    }

    return url;
  },

  serializeData: function() {
    var data = parseForTemplate(this.model.toJSON(), this.roomMenuModel.get('state'));
    return data;
  }
});

module.exports = BaseCollectionView.extend({
  childView: ItemView,
  className: 'tertiary-collection',

  ui: _.extend({}, BaseCollectionView.prototype.ui, {
    header: '#collection-header'
  }),

  initialize: function(attrs) {
    this.roomMenuModel = attrs.roomMenuModel;
    this.roomCollection = attrs.roomCollection;
    this.primaryCollection = attrs.primaryCollection;
    this.secondaryCollection = attrs.secondaryCollection;

    this.listenTo(this.collection, 'filter-complete sync', this.render, this);

    BaseCollectionView.prototype.initialize.apply(this, arguments);
  },

  getEmptyView: function() {
    switch (this.roomMenuModel.get('state')) {
      case 'search':
        return EmptySearchView;
      default:
        return Marionette.ItemView.extend({ template: false });
    }
  },

  filter: function(model, index) {
    switch (this.roomMenuModel.get('state')) {
      case 'search':
        return index <= 5;
      default:
        return (
          !this.primaryCollection.get(model.get('id')) &&
          !this.secondaryCollection.get(model.get('id'))
        );
    }
  },

  onItemActivated: function() {
    switch (this.roomMenuModel.get('state')) {
      case 'search':
        return this.onSearchItemClicked.apply(this, arguments);
      default:
        return proto.onItemActivated.apply(this, arguments);
    }
  },

  /** Called from the base class */
  roomExistsForModel: function(model) {
    if (this.roomMenuModel.get('state') === 'all') {
      // Org room case
      return !!model.get('room');
    } else {
      return model.get('exists') !== false;
    }
  },

  onSearchItemClicked: function(view) {
    this.roomMenuModel.set('searchTerm', view.model.get('name'));
    this.bus.trigger('left-menu:recent-search', view.model.get('name'));
  },

  onRender: function() {
    BaseCollectionView.prototype.onRender.apply(this, arguments);
    if (this.ui.header && this.ui.header[0]) {
      toggleClass(
        this.ui.header[0],
        'hidden',
        this.isEmpty() && this.roomMenuModel.get('state') === 'search'
      );
    }
  },

  onDestroy: function() {
    this.stopListening();
  }
});
