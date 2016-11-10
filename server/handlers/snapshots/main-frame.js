"use strict";

var parseRoomsIntoLeftMenuRoomList = require('./left-menu/left-menu-room-list');
var parseRoomsIntoLeftMenuFavouriteRoomList = require('./left-menu/left-menu-room-favourite-list');
var parseCategoryForTemplate = require('gitter-web-shared/parse/forum-category-item');
var generateLeftMenuStateForUriContext = require('./left-menu/generate-left-menu-state-for-uri-context');

function getMainFrameSnapshots(uriContext, leftMenuPeristedState, rooms, groups, extras) {
  var leftMenu = generateLeftMenuStateForUriContext(uriContext, leftMenuPeristedState, extras);

  var forumCategories = (extras.leftMenuForumGroupCategories || []).map(function(category) {
    category.groupUri = extras.leftMenuForumGroup && extras.leftMenuForumGroup.uri;
    return category;
  });

  var forum, parsedRooms, parsedFavourites;

  if(leftMenu.state === 'group') {
    parsedRooms = groups;
    parsedFavourites = [];
  } else {
    parsedRooms = parseRoomsIntoLeftMenuRoomList(leftMenu.state, rooms, leftMenu.groupId);
    parsedFavourites = parseRoomsIntoLeftMenuFavouriteRoomList(leftMenu.state, rooms, leftMenu.groupId);

    if (forumCategories && (leftMenu.state === 'org' || leftMenu.state === 'temp-org')) {
      forum = {
        hasCategories: forumCategories.length > 0,
        categories: forumCategories.map(parseCategoryForTemplate)
      };
    }
  }

  return {
    leftMenu: leftMenu,
    allRooms: rooms,
    rooms: parsedRooms,
    favourites: parsedFavourites,
    groups: groups,
    forum: forum
  };
}

module.exports = getMainFrameSnapshots;
