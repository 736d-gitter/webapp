import appEvents from '../../../utils/appevents';
import apiClient from '../../../components/api-client';
import moment from 'moment';
import * as rootTypes from '../../store/mutation-types';
import VuexApiRequest from '../../store/vuex-api-request';
import { generateChildMessageTmpId } from '../../store/mutations';

const FETCH_MESSAGES_LIMIT = 50;

// Exported for testing
export const childMessagesVuexRequest = new VuexApiRequest(
  'CHILD_MESSAGES',
  'childMessagesRequest'
);

const canStartFetchingMessages = state =>
  !state.childMessagesRequest.loading && !state.childMessagesRequest.error;

// Exported for testing
export const types = {
  TOGGLE_THREAD_MESSAGE_FEED: 'TOGGLE_THREAD_MESSAGE_FEED',
  SET_PARENT_MESSAGE_ID: 'SET_PARENT_MESSAGE_ID',
  UPDATE_DRAFT_MESSAGE: 'UPDATE_DRAFT_MESSAGE',
  SET_AT_TOP: 'SET_AT_TOP',
  SET_AT_BOTTOM: 'SET_AT_BOTTOM',
  CLEAR_STATE: 'CLEAR_STATE',
  ...childMessagesVuexRequest.types // just for completeness, the types are referenced as `childMessagesVuexRequest.successType`
};

export default {
  namespaced: true,
  state: () => ({
    isVisible: false,
    draftMessage: '',
    atTop: false,
    atBottom: false,
    parentId: null,
    ...childMessagesVuexRequest.initialState
  }),
  mutations: {
    [types.TOGGLE_THREAD_MESSAGE_FEED](state, isVisible) {
      state.isVisible = isVisible;
    },
    [types.SET_PARENT_MESSAGE_ID](state, parentId) {
      state.parentId = parentId;
    },
    [types.UPDATE_DRAFT_MESSAGE](state, draftMessage) {
      state.draftMessage = draftMessage;
    },
    [types.SET_AT_TOP](state) {
      state.atTop = true;
    },
    [types.SET_AT_BOTTOM](state) {
      state.atBottom = true;
    },
    [types.CLEAR_STATE](state) {
      state.parentId = null;
      state.draftMessage = '';
      state.atTop = false;
      state.atBottom = false;
    },
    ...childMessagesVuexRequest.mutations
  },
  getters: {
    parentMessage: (state, getters, rootState) => {
      return rootState.messageMap[state.parentId];
    },
    childMessages: (state, getters, rootState) => {
      const { parentId } = state;
      const childMessages = Object.values(rootState.messageMap).filter(
        m => m.parentId === parentId
      );
      // we use moment because the messages combine messages from bayeux and ordinary json messages (fetch during TMF open)
      return childMessages.sort((m1, m2) => moment(m1.sent).diff(m2.sent)); // sort from oldest to latest
    }
  },
  actions: {
    open: ({ commit, dispatch }, parentId) => {
      commit(types.CLEAR_STATE);
      commit(types.TOGGLE_THREAD_MESSAGE_FEED, true);
      commit(types.SET_PARENT_MESSAGE_ID, parentId);
      appEvents.trigger('vue:right-toolbar:toggle', false);
      return dispatch('fetchInitialMessages');
    },
    close: ({ commit }) => {
      commit(types.TOGGLE_THREAD_MESSAGE_FEED, false);
      appEvents.trigger('vue:right-toolbar:toggle', true);
    },
    updateDraftMessage: ({ commit }, newDraftMessage) => {
      commit(types.UPDATE_DRAFT_MESSAGE, newDraftMessage);
    },
    sendMessage: ({ state, commit, rootState }) => {
      const messagePayload = {
        text: state.draftMessage,
        parentId: state.parentId
      };
      const fromUser = rootState.user;
      const tmpMessage = {
        ...messagePayload,
        id: generateChildMessageTmpId(state.parentId, fromUser._id, state.draftMessage),
        fromUser,
        sent: new Date(Date.now())
      };
      commit(rootTypes.ADD_TO_MESSAGE_MAP, [{ ...tmpMessage, loading: true }], { root: true });
      apiClient.room
        .post('/chatMessages', messagePayload)
        .then(message => {
          // the message from the API response fully replaces the `tmpMessage` and because it
          // doesn't contain the `loading` attribute, UI will hide the loading indicator
          commit(rootTypes.ADD_TO_MESSAGE_MAP, [message], { root: true });
        })
        .catch(() => {
          commit(rootTypes.ADD_TO_MESSAGE_MAP, [{ ...tmpMessage, error: true, loading: false }], {
            root: true
          });
        });
      commit(types.UPDATE_DRAFT_MESSAGE, '');
    },
    fetchChildMessages: (
      { state, commit },
      { beforeId, afterId, limit = FETCH_MESSAGES_LIMIT } = {}
    ) => {
      commit(childMessagesVuexRequest.requestType);
      const options = { beforeId, afterId, limit };
      const query = Object.keys(options)
        .filter(key => options[key])
        .map(key => key + '=' + options[key])
        .join('&');
      return apiClient.room
        .get(`/chatMessages/${state.parentId}/thread${query ? '?' + query : ''}`)
        .then(childMessages => {
          commit(childMessagesVuexRequest.successType);
          commit(rootTypes.ADD_TO_MESSAGE_MAP, childMessages, { root: true });
          return childMessages;
        })
        .catch((/* error */) => {
          // error is reported by apiClient
          commit(childMessagesVuexRequest.errorType);
        });
    },
    highlightChildMessage: ({ dispatch, commit }, { parentId, id }) => {
      dispatch('open', parentId).then(() => {
        commit(rootTypes.UPDATE_MESSAGE, { id, highlighted: true }, { root: true });
        setTimeout(
          () => commit(rootTypes.UPDATE_MESSAGE, { id, highlighted: false }, { root: true }),
          5000
        );
      });
    },
    focusOnMessage: ({ commit }, id) => {
      commit(rootTypes.UPDATE_MESSAGE, { id, focused: true }, { root: true });
      setTimeout(
        () => commit(rootTypes.UPDATE_MESSAGE, { id, focused: false }, { root: true }),
        5000
      );
    },
    fetchEarlierMessages: ({ dispatch, state, getters, commit }) => {
      if (state.atTop || !canStartFetchingMessages(state)) return;
      if (getters.childMessages.length) return;
      dispatch('fetchChildMessages', { beforeId: getters.childMessages[0].id }).then(
        childMessages => {
          if (childMessages.length < FETCH_MESSAGES_LIMIT) commit(types.SET_AT_TOP);
        }
      );
    },
    fetchLaterMessages: ({ dispatch, state, getters, commit }) => {
      if (state.atBottom || !canStartFetchingMessages(state)) return;
      const childMessages = getters.childMessages;
      if (!childMessages.length) return;
      dispatch('fetchChildMessages', { afterId: childMessages[childMessages.length - 1].id }).then(
        childMessages => {
          if (childMessages.length < FETCH_MESSAGES_LIMIT) commit(types.SET_AT_BOTTOM);
        }
      );
    },
    fetchInitialMessages: ({ dispatch, commit }) => {
      return dispatch('fetchChildMessages').then(childMessages => {
        const lastMessage = childMessages[childMessages.length - 1];
        if (lastMessage) dispatch('focusOnMessage', lastMessage.id);
        commit(types.SET_AT_BOTTOM);
        if (childMessages.length < FETCH_MESSAGES_LIMIT) {
          commit(types.SET_AT_TOP);
        }
      });
    }
  }
};
