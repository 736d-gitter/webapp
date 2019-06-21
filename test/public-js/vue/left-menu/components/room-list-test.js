'use strict';

const { createLocalVue, shallowMount } = require('@vue/test-utils');
const Vue = require('vue');
const Vuex = require('vuex');

const createStore = require('../../../../../public/js/vue/store').default;
const actions = require('../../../../../public/js/vue/store/actions');
const RoomList = require('../../../../../public/js/vue/left-menu/components/room-list.vue');

const { createSerializedRoomFixture } = require('../../fixture-helpers');

let wrapper;
let store;
let stubbedActions = {};
function factory(propsData = {}, extendStore = () => {}) {
  const localVue = createLocalVue();
  localVue.use(Vuex);

  Object.keys(actions).forEach(actionKey => {
    stubbedActions[actionKey] = jest.fn().mockImplementation(actions[actionKey]);
  });

  store = createStore({
    actions: stubbedActions
  });
  extendStore(store);

  wrapper = shallowMount(RoomList.default, {
    localVue,
    store,
    propsData
  });
}

describe('room-list', () => {
  afterEach(() => {
    wrapper.destroy();
  });

  it('matches snapshot', () => {
    factory({ rooms: [] });
    expect(wrapper.element).toMatchSnapshot();
  });

  it('matches snapshot with some rooms', () => {
    factory({
      rooms: [
        createSerializedRoomFixture('community/room1'),
        createSerializedRoomFixture('community/room2'),
        createSerializedRoomFixture('community/room3')
      ]
    });
    expect(wrapper.element).toMatchSnapshot();
  });

  it('matches snapshot with some favourite rooms', () => {
    factory({
      rooms: [
        createSerializedRoomFixture('community/room1'),
        createSerializedRoomFixture('community/room2'),
        {
          ...createSerializedRoomFixture('community/favourite-room1'),
          favourite: 1
        },
        createSerializedRoomFixture('community/room3'),
        {
          ...createSerializedRoomFixture('community/favourite-room2'),
          favourite: 2
        }
      ]
    });
    expect(wrapper.element).toMatchSnapshot();
  });

  it('calls store action "updatefavouriteDraggingInProgress" -> true when dragging starts', async () => {
    factory({
      rooms: []
    });

    wrapper.vm.dragStart();

    expect(stubbedActions.updatefavouriteDraggingInProgress).toHaveBeenCalledWith(
      expect.anything(),
      true,
      undefined
    );
  });

  it('calls store action "updatefavouriteDraggingInProgress" -> false when dragging starts', async () => {
    factory({
      rooms: []
    });

    wrapper.vm.dragEnd();

    expect(stubbedActions.updatefavouriteDraggingInProgress).toHaveBeenCalledWith(
      expect.anything(),
      false,
      undefined
    );
  });

  describe('moving a favourite room', () => {
    const favouriteRoom1 = {
      ...createSerializedRoomFixture('community/favourite-room1'),
      favourite: 1
    };
    const favouriteRoom2 = {
      ...createSerializedRoomFixture('community/favourite-room2'),
      favourite: 2
    };
    const favouriteRoom3 = {
      ...createSerializedRoomFixture('community/favourite-room3'),
      favourite: 3
    };
    const favouriteRoom4 = {
      ...createSerializedRoomFixture('community/favourite-room4'),
      favourite: 4
    };

    beforeEach(() => {
      factory(
        {
          rooms: [favouriteRoom1, favouriteRoom2, favouriteRoom3, favouriteRoom4]
        },
        store => {
          store.state.roomMap = {
            [favouriteRoom1.id]: favouriteRoom1,
            [favouriteRoom2.id]: favouriteRoom2,
            [favouriteRoom3.id]: favouriteRoom3,
            [favouriteRoom4.id]: favouriteRoom4
          };
        }
      );
    });

    it('calls store action "updateRoomFavourite" with (maxfavourite + 1) when favourite room moved from first to last', async () => {
      const oldIndex = 0;
      const newIndex = wrapper.vm.favouriteRooms.length - 1;
      wrapper.vm.favouriteMoved({ oldIndex, newIndex });

      expect(stubbedActions.updateRoomFavourite).toHaveBeenCalledWith(
        expect.anything(),
        {
          id: wrapper.vm.favouriteRooms[oldIndex].id,
          favourite: wrapper.vm.favouriteRooms[newIndex].favourite + 1
        },
        undefined
      );

      // Add a bit of integration test just to make sure things are flowing all the way to the store correctly
      await Vue.nextTick();
      expect(
        Object.values(store.state.roomMap).map(({ id, favourite }) => ({ id, favourite }))
      ).toMatchSnapshot();
    });

    it('calls store action "updateRoomFavourite" with favourite of the sibling it bumps when favourite room moved from last to first', async () => {
      const oldIndex = wrapper.vm.favouriteRooms.length - 1;
      const newIndex = 0;
      wrapper.vm.favouriteMoved({ oldIndex, newIndex });

      expect(stubbedActions.updateRoomFavourite).toHaveBeenCalledWith(
        expect.anything(),
        {
          id: wrapper.vm.favouriteRooms[oldIndex].id,
          favourite: wrapper.vm.favouriteRooms[newIndex].favourite
        },
        undefined
      );

      // Add a bit of integration test just to make sure things are flowing all the way to the store correctly
      await Vue.nextTick();
      expect(
        Object.values(store.state.roomMap).map(({ id, favourite }) => ({ id, favourite }))
      ).toMatchSnapshot();
    });

    it('calls store action "updateRoomFavourite" with favourite of the sibling it bumps when favourite room moved upwards (in the middle)', async () => {
      const oldIndex = wrapper.vm.favouriteRooms.length - 1;
      const newIndex = 1;
      wrapper.vm.favouriteMoved({ oldIndex, newIndex });

      expect(stubbedActions.updateRoomFavourite).toHaveBeenCalledWith(
        expect.anything(),
        {
          id: wrapper.vm.favouriteRooms[oldIndex].id,
          favourite: wrapper.vm.favouriteRooms[newIndex].favourite
        },
        undefined
      );

      // Add a bit of integration test just to make sure things are flowing all the way to the store correctly
      await Vue.nextTick();
      expect(
        Object.values(store.state.roomMap).map(({ id, favourite }) => ({ id, favourite }))
      ).toMatchSnapshot();
    });

    it('calls store action "updateRoomFavourite" with favourite of sibling it bumps accountnig for itself when favourite room moved downwards (in the middle)', async () => {
      const oldIndex = 0;
      const newIndex = 2;
      wrapper.vm.favouriteMoved({ oldIndex, newIndex });

      expect(stubbedActions.updateRoomFavourite).toHaveBeenCalledWith(
        expect.anything(),
        {
          id: wrapper.vm.favouriteRooms[oldIndex].id,
          favourite: wrapper.vm.favouriteRooms[newIndex + 1].favourite
        },
        undefined
      );

      // Add a bit of integration test just to make sure things are flowing all the way to the store correctly
      await Vue.nextTick();
      expect(
        Object.values(store.state.roomMap).map(({ id, favourite }) => ({ id, favourite }))
      ).toMatchSnapshot();
    });
  });

  describe('adding a favourite room (dragging from normal to favourite list)', () => {
    const favouriteRoom1 = {
      ...createSerializedRoomFixture('community/favourite-room1'),
      favourite: 1
    };
    const favouriteRoom2 = {
      ...createSerializedRoomFixture('community/favourite-room2'),
      favourite: 2
    };
    const favouriteRoom3 = {
      ...createSerializedRoomFixture('community/favourite-room3'),
      favourite: 3
    };
    const room1 = createSerializedRoomFixture('community/room1');

    beforeEach(() => {
      factory(
        {
          rooms: [favouriteRoom1, favouriteRoom2, favouriteRoom3, room1]
        },
        store => {
          store.state.roomMap = {
            [favouriteRoom1.id]: favouriteRoom1,
            [favouriteRoom2.id]: favouriteRoom2,
            [favouriteRoom3.id]: favouriteRoom3,
            [room1.id]: room1
          };
        }
      );
    });

    it('calls store action "updateRoomFavourite" with new room favourite', async () => {
      const oldIndex = 0;
      const newIndex = 2;
      wrapper.vm.favouriteAdded({ oldIndex, newIndex });

      expect(stubbedActions.updateRoomFavourite).toHaveBeenCalledWith(
        expect.anything(),
        {
          id: wrapper.vm.normalRooms[oldIndex].id,
          favourite: wrapper.vm.favouriteRooms[newIndex].favourite
        },
        undefined
      );

      // Add a bit of integration test just to make sure things are flowing all the way to the store correctly
      await Vue.nextTick();
      expect(
        Object.values(store.state.roomMap).map(({ id, favourite }) => ({ id, favourite }))
      ).toMatchSnapshot();
    });
  });

  describe('removing a favourite room (dragging from favourite list to normal list)', () => {
    const favouriteRoom1 = {
      ...createSerializedRoomFixture('community/favourite-room1'),
      favourite: 1
    };
    const room1 = createSerializedRoomFixture('community/room1');
    const room2 = createSerializedRoomFixture('community/room2');
    const room3 = createSerializedRoomFixture('community/room3');

    beforeEach(() => {
      factory(
        {
          rooms: [favouriteRoom1, room1, room2, room3]
        },
        store => {
          store.state.roomMap = {
            [favouriteRoom1.id]: favouriteRoom1,
            [room1.id]: room1,
            [room2.id]: room2,
            [room3.id]: room3
          };
        }
      );
    });

    it('calls store action "updateRoomFavourite" with removed room favourite', async () => {
      const oldIndex = 0;
      const newIndex = 1;
      wrapper.vm.favouriteRemoved({ oldIndex, newIndex });

      expect(stubbedActions.updateRoomFavourite).toHaveBeenCalledWith(
        expect.anything(),
        {
          id: wrapper.vm.favouriteRooms[oldIndex].id,
          favourite: false
        },
        undefined
      );

      // Add a bit of integration test just to make sure things are flowing all the way to the store correctly
      await Vue.nextTick();
      expect(
        Object.values(store.state.roomMap).map(({ id, favourite }) => ({ id, favourite }))
      ).toMatchSnapshot();
    });
  });
});
