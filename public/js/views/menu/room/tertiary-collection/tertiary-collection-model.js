'use strict';

var BaseCollectionModel = require('../base-collection/base-collection-model');

module.exports = BaseCollectionModel.extend({

  onAll: function() {
    this.set({
      active: false
    });
  },

  onSearch: function() {
    this.set({
      header:       'Recent Searches',
      isSuggestion: false,
      active: !this.roomMenuModel.get('searchTerm'),
    });
  },

  onOrg: function (){
    this.set({
      header: 'Your Suggestions',
      isSuggestion: true,
      active: !!this.collection.length && !this.roomMenuModel.get('hasDismissedSuggestions'),
    });
  },

  onGroup: function(){
    this.set({
      header: false,
      active: false
    })
  },

  onDefault: function() {
    this.set({
      header:       false,
      isSuggestion: false,
      active: !!this.collection.length && !!this.collection.models.length
    });
  },
});
