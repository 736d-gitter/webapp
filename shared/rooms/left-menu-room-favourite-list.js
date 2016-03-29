'use strict';

var favouriteFilter         = require('../filters/left-menu-primary-favourite');
var favouriteOneToOneFilter = require('../filters/left-menu-primary-favourite-one2one');

var favouriteSort      = require('../sorting/left-menu-primary-favourite');
var defaultSort        = require('../sorting/left-menu-primary-default');
var orgFavouriteFilter = require('../filters/left-menu-primary-favourite-one2one');

var parseToTemplateItem = require('../parse/left-menu-primary-item');

module.exports = function generateLemMenuFavouriteRoomsList(state, rooms, selectedOrgName) {

  switch(state) {
    case 'search':
      return [];
    case 'people':
      return rooms.filter(favouriteOneToOneFilter).sort(defaultSort).map(parseToTemplateItem);
    case 'org':
      return rooms
        .filter(function(model){ return orgFavouriteFilter(model, selectedOrgName); })
        .sort(defaultSort)
        .map(parseToTemplateItem);
    default:
      return rooms.filter(favouriteFilter).sort(favouriteSort).map(parseToTemplateItem);
  }

};
