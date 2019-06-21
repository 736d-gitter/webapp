import Vue from 'vue';
import * as types from './mutation-types';
import fuzzysearch from 'fuzzysearch';

function roomFilter(searchTermInput = '', room) {
  const searchTerm = searchTermInput.toLowerCase();

  const name = (room.name || '').toLowerCase();
  const uri = (room.url || '').replace(/^\//, '').toLowerCase();

  return searchTerm.length > 0 && (fuzzysearch(searchTerm, name) || fuzzysearch(searchTerm, uri));
}

export default {
  [types.SET_INITIAL_DATA](state, data) {
    Object.assign(state, data);
  },
  [types.SET_TEST](state, testValue) {
    state.test = testValue;
  },

  [types.SWITCH_LEFT_MENU_STATE](state, newLeftMenuState) {
    state.leftMenuState = newLeftMenuState;
  },
  [types.TOGGLE_LEFT_MENU_PINNED_STATE](state, newPinnedState) {
    state.leftMenuPinnedState = newPinnedState;
    // Always collapse when you unpinning
    // When the menu is pinned, the expanded state has no effect (always fully shown when pinned)
    state.leftMenuExpandedState = false;
  },
  [types.TOGGLE_LEFT_MENU](state, newToggleState) {
    state.leftMenuExpandedState = newToggleState;
  },

  [types.UPDATE_FAVOURITE_DRAGGING_STATE](state, newToggleState) {
    state.favouriteDraggingInProgress = newToggleState;
  },
  [types.REQUEST_ROOM_FAVOURITE](state, roomId) {
    const resultantRoomState = { ...state.roomMap[roomId], error: false, loading: true };
    Vue.set(state.roomMap, roomId, resultantRoomState);
  },
  [types.RECEIVE_ROOM_FAVOURITE_SUCCESS](state, roomId) {
    const resultantRoomState = { ...state.roomMap[roomId], error: false, loading: false };
    Vue.set(state.roomMap, roomId, resultantRoomState);
  },
  [types.RECEIVE_ROOM_FAVOURITE_ERROR](state, { id: roomId, error = true }) {
    const resultantRoomState = { ...state.roomMap[roomId], error, loading: false };
    Vue.set(state.roomMap, roomId, resultantRoomState);
  },

  [types.UPDATE_SEARCH_INPUT_VALUE](state, newSearchInputValue) {
    state.search.searchInputValue = newSearchInputValue;
  },
  [types.SEARCH_CLEARED](state) {
    state.search.current.results = [];
    state.search.repo = { loading: false, error: false, results: [] };
    state.search.room = { loading: false, error: false, results: [] };
    state.search.people = { loading: false, error: false, results: [] };
    state.search.message = { loading: false, error: false, results: [] };
  },
  [types.UPDATE_ROOM_SEARCH_CURRENT](state) {
    state.search.current.results = Object.values(state.roomMap).filter(room =>
      roomFilter(state.search.searchInputValue, room)
    );
  },

  [types.REQUEST_ROOM_SEARCH_REPO](state) {
    state.search.repo.error = false;
    state.search.repo.loading = true;
  },
  [types.RECEIVE_ROOM_SEARCH_REPO_SUCCESS](state, searchResults) {
    state.search.repo.error = false;
    state.search.repo.loading = false;
    state.search.repo.results = searchResults;
  },
  [types.RECEIVE_ROOM_SEARCH_REPO_ERROR](state) {
    state.search.repo.error = true;
    state.search.repo.loading = false;
    state.search.repo.results = [];
  },

  [types.REQUEST_ROOM_SEARCH_ROOM](state) {
    state.search.room.error = false;
    state.search.room.loading = true;
  },
  [types.RECEIVE_ROOM_SEARCH_ROOM_SUCCESS](state, searchResults) {
    state.search.room.error = false;
    state.search.room.loading = false;
    state.search.room.results = searchResults;
  },
  [types.RECEIVE_ROOM_SEARCH_ROOM_ERROR](state) {
    state.search.room.error = true;
    state.search.room.loading = false;
    state.search.room.results = [];
  },

  [types.REQUEST_ROOM_SEARCH_PEOPLE](state) {
    state.search.people.error = false;
    state.search.people.loading = true;
  },
  [types.RECEIVE_ROOM_SEARCH_PEOPLE_SUCCESS](state, searchResults) {
    state.search.people.error = false;
    state.search.people.loading = false;
    state.search.people.results = searchResults;
  },
  [types.RECEIVE_ROOM_SEARCH_PEOPLE_ERROR](state) {
    state.search.people.error = true;
    state.search.people.loading = false;
    state.search.people.results = [];
  },

  [types.REQUEST_MESSAGE_SEARCH](state) {
    state.search.message.error = false;
    state.search.message.loading = true;
  },
  [types.RECEIVE_MESSAGE_SEARCH_SUCCESS](state, searchResults) {
    state.search.message.error = false;
    state.search.message.loading = false;
    state.search.message.results = searchResults;
  },
  [types.RECEIVE_MESSAGE_SEARCH_ERROR](state) {
    state.search.message.error = true;
    state.search.message.loading = false;
    state.search.message.results = [];
  },

  [types.CHANGE_DISPLAYED_ROOM](state, newRoomId) {
    state.displayedRoomId = newRoomId;
    state.hightLightedMessageId = null;
  },
  [types.CHANGE_HIGHLIGHTED_MESSAGE_ID](state, newMessageId) {
    state.hightLightedMessageId = newMessageId;
  },

  [types.UPDATE_ROOM](state, newRoomState) {
    if (newRoomState.id) {
      const resultantRoomState = Object.assign(
        {},
        state.roomMap[newRoomState.id] || {},
        newRoomState
      );
      Vue.set(state.roomMap, newRoomState.id, resultantRoomState);
    }
  }
};