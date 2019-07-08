'use strict';

const { createLocalVue, shallowMount } = require('@vue/test-utils');
const Vuex = require('vuex');
const _ = require('lodash');

const { default: createStore, modules } = require('../../../public/js/vue/store');
const actions = require('../../../public/js/vue/store/actions');

const mount = (Component, propsData = {}, extendStore = () => {}) => {
  const localVue = createLocalVue();
  localVue.use(Vuex);

  const stubbedActions = _.mapValues(actions, action => jest.fn().mockImplementation(action));

  // Mock actions inside of all modules
  // { moduleName: { actions: { name: implementation }, mutations: {} } }
  // changes to
  // { moduleName: { actions: { name: mockImplementation}, mutations: {} } }
  const stubbedModules = _.mapValues(modules, module => ({
    ...module,
    actions: _.mapValues(module.actions, action => jest.fn().mockImplementation(action))
  }));

  const store = createStore({
    actions: stubbedActions,
    modules: stubbedModules
  });
  extendStore(store);

  const wrapper = shallowMount(Component, {
    localVue,
    store,
    propsData
  });

  const stubbedModuleActions = _.mapValues(stubbedModules, stubbedModule => stubbedModule.actions);
  // You can access stubbed module actions by `stubbedActions.moduleName.actionName`
  return { wrapper, stubbedActions: _.merge(stubbedActions, stubbedModuleActions), store };
};

module.exports = mount;