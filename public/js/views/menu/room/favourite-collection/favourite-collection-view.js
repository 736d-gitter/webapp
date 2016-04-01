'use strict';

var Marionette            = require('backbone.marionette');
var PrimaryCollectionView = require('../primary-collection/primary-collection-view');
var BaseCollectionView    = require('../base-collection/base-collection-view');
var ItemView              = require('./favourite-collection-item-view');

var FavouriteCollection = PrimaryCollectionView.extend({

  childView: ItemView,
  initialize: function() {
    PrimaryCollectionView.prototype.initialize.apply(this, arguments);
    this.listenTo(this.dndCtrl, 'dnd:start-drag', this.onDragStart, this);
    this.listenTo(this.dndCtrl, 'dnd:start-end room-menu:add-favourite room-menu:sort-favourite', this.onDragEnd, this);
  },

  getChildContainerToBeIndexed: function () {
    //For the favourite collection we use the first child because there
    //is no search header unlike the primary collection
    return this.el.children[0];
  },

  //JP 29/3/16
  //The primary collection has some show/hide logic around it's search header
  //in the favourite collection we don't have that piece of UI so we override and delegate
  //down to the base class. Not ideal but I don't want to introduce another layer of inheritance
  //between this and the primary collection at this point.
  //If the complexity around this rises I may consider it
  setActive: function () {
    BaseCollectionView.prototype.setActive.apply(this, arguments);
  },

  getEmptyView: function() {
    switch (this.roomMenuModel.get('state')) {
      default:
        return Marionette.ItemView.extend({ template: false });
    }
  },

  onDragStart: function () {
    this.el.classList.add('dragging');
    console.log('this is working', this.el);
  },

  onDragEnd: function () {
    console.log('this is drag end');
    this.el.classList.remove('dragging');
  },

});

module.exports =  FavouriteCollection;
