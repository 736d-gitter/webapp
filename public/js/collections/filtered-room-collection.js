'use strict';

var Backbone = require('backbone');
var BackboneFilteredCollection = require('filtered-collection');

module.exports = Backbone.FilteredCollection.extend({
  initialize: function(collection, options) {//jshint unused: true
    if (!options || !options.roomModel) {
      throw new Error('A valid RoomMenuModel must be passed to a new instance of FilteredRoomCollection');
    }

    this.roomModel = options.roomModel;
    this.listenTo(this.roomModel, 'change:state', this.onModelChangeState, this);
    this.listenTo(this.roomModel, 'change:selectedOrgName', this.onOrgNameChange, this);

    if (!options || !options.collection) {
      throw new Error('A valid RoomCollection must be passed to a new instance of FilteredRoomCollection');
    }

    this.roomCollection = options.collection;
    this.listenTo(this.roomCollection, 'snapshot', this.onRoomCollectionSnapshot, this);

    this.listenTo(this, 'sync', this.onSync, this);

    BackboneFilteredCollection.prototype.initialize.apply(this, arguments);
  },

  onModelChangeState: function(model, val) {//jshint unused: true
    switch (val) {
      case 'favourite' :
        this.setFilter(this.filterFavourite);
        this.comparator = this.sortFavourites;
        this.sort();
        break;
      case 'people' :
        this.comparator = null;
        this.setFilter(this.filterOneToOnes);
        break;
      case 'search' :
        this.comparator = null;
        this.setFilter(this.filterSearches);
        break;
      case 'org' :
        this.comparator = null;
        this.setFilter(this.filterOrgRooms.bind(this));
        break;
      default:
        this.comparator = null;
        this.setFilter(false);
        break;
    }
  },

  onOrgNameChange: function() {
    this.setFilter();
  },

  filterFavourite: function(model) {
    return !!model.get('favourite');
  },

  filterOneToOnes: function(model) {
    return model.get('githubType') === 'ONETOONE';
  },

  filterSearches: function() {
    return false;
  },

  filterOrgRooms: function(model) {
    var orgName = this.roomModel.get('selectedOrgName');
    var name    = model.get('name').split('/')[0];
    return (name === orgName) && !!model.get('roomMember');
  },

  onRoomCollectionSnapshot: function() {
    var args = Array.prototype.slice.call(arguments);
    this.trigger.apply(this, ['snapshot'].concat(args));
  },

  sortFavourites: function(a, b) {
    return (a.get('favourite') < b.get('favourite')) ? -1 : 1;
  },

  onSync: function (){
    if(this.comparator) { this.sort() }
  },

});
