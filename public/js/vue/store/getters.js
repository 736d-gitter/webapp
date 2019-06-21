import _ from 'underscore';
import { pojo as sortsAndFilters } from 'gitter-realtime-client/lib/sorts-filters';

function sortRooms(a, b) {
  if (a.favourite || b.favourite) {
    return sortsAndFilters.favourites.sort(a, b);
  }

  return sortsAndFilters.recents.sort(a, b);
}

export const displayedRoom = state => {
  return state.roomMap[state.displayedRoomId];
};

export const displayedRooms = state => {
  let resultantRooms = [];

  if (state.leftMenuState === 'people') {
    resultantRooms = Object.keys(state.roomMap)
      .filter(roomKey => state.roomMap[roomKey].oneToOne)
      .map(roomKey => state.roomMap[roomKey]);
  } else {
    resultantRooms = Object.keys(state.roomMap).map(roomKey => state.roomMap[roomKey]);
  }

  resultantRooms = resultantRooms.filter(sortsAndFilters.leftMenu.filter);
  resultantRooms.sort(sortRooms);

  return resultantRooms;
};

export const displayedRoomSearchResults = state => {
  const allResults = [
    ...state.search.current.results,
    ...state.search.repo.results,
    ...state.search.room.results,
    ...state.search.people.results
  ];

  const uniqueResults = _.uniq(allResults, false, 'url');

  return uniqueResults.slice(0, 6);
};