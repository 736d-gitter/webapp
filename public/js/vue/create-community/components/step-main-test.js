const mount = require('../../__test__/vuex-mount');
const { default: StepMain } = require('./step-main.vue');

const {
  createOrgGitlabGroupFixture,
  createRepoGithubRepoFixture
} = require('../../__test__/fixture-helpers');

import {
  CREATE_COMMUNITY_STEP_BACKING_ENTITY_GITLAB,
  CREATE_COMMUNITY_STEP_BACKING_ENTITY_GITHUB
} from '../constants';

jest.mock('gitter-web-client-context');
const context = require('gitter-web-client-context');

describe('StepMain', () => {
  beforeEach(() => {
    context.hasProvider.mockReset();
  });

  it('GitLab user matches snapshot', () => {
    context.hasProvider.mockImplementation(provider => {
      if (provider === 'gitlab') {
        return true;
      }
    });

    const { wrapper } = mount(StepMain, {});
    expect(wrapper.element).toMatchSnapshot();
  });

  it('GitHub user matches snapshot', () => {
    context.hasProvider.mockImplementation(provider => {
      if (provider === 'github') {
        return true;
      }
    });

    const { wrapper } = mount(StepMain, {});
    expect(wrapper.element).toMatchSnapshot();
  });

  describe('filling out the name/slug', () => {
    it('should update community name when user adds input', () => {
      const { wrapper, stubbedActions } = mount(StepMain, {});
      wrapper.find({ ref: 'communityNameInput' }).element.value = 'hello';
      wrapper.find({ ref: 'communityNameInput' }).trigger('input');

      expect(stubbedActions.createCommunity.setCommunityName).toHaveBeenCalledWith(
        expect.anything(),
        'hello',
        undefined
      );
    });

    it('should update community slug when user adds input', () => {
      const { wrapper, stubbedActions } = mount(StepMain, {});
      wrapper.find({ ref: 'communitySlugInput' }).element.value = 'some-slug';
      wrapper.find({ ref: 'communitySlugInput' }).trigger('input');

      expect(stubbedActions.createCommunity.setAndValidateCommunitySlug).toHaveBeenCalledWith(
        expect.anything(),
        'some-slug',
        undefined
      );
    });
  });

  describe('errors', () => {
    it('community name error', () => {
      const { wrapper } = mount(StepMain, {}, store => {
        store.state.createCommunity.communityNameError = 'SOME BAD ERROR!';
      });
      expect(wrapper.element).toMatchSnapshot();
    });

    it('community slug error', () => {
      const { wrapper } = mount(StepMain, {}, store => {
        store.state.createCommunity.communitySlugError = 'SOME BAD ERROR!';
      });
      expect(wrapper.element).toMatchSnapshot();
    });
  });

  describe('prompt links', () => {
    it('clicking GitLab prompt moves to backing entity GitLab step', () => {
      context.hasProvider.mockImplementation(provider => {
        if (provider === 'gitlab') {
          return true;
        }
      });

      const { wrapper, stubbedActions } = mount(StepMain, {});

      wrapper.find({ ref: 'backingEntityPromptGitlabLink' }).trigger('click');

      expect(stubbedActions.createCommunity.moveToStep).toHaveBeenCalledWith(
        expect.anything(),
        CREATE_COMMUNITY_STEP_BACKING_ENTITY_GITLAB,
        undefined
      );
    });

    it('clicking GitHub prompt moves to backing entity GitHub step', () => {
      context.hasProvider.mockImplementation(provider => {
        if (provider === 'github') {
          return true;
        }
      });

      const { wrapper, stubbedActions } = mount(StepMain, {});

      wrapper.find({ ref: 'backingEntityPromptGithubLink' }).trigger('click');

      expect(stubbedActions.createCommunity.moveToStep).toHaveBeenCalledWith(
        expect.anything(),
        CREATE_COMMUNITY_STEP_BACKING_ENTITY_GITHUB,
        undefined
      );
    });
  });

  describe('entity selected', () => {
    it('matches snapshot', () => {
      context.hasProvider.mockImplementation(provider => {
        if (provider === 'gitlab') {
          return true;
        }
      });

      const { wrapper } = mount(StepMain, {}, store => {
        store.state.createCommunity.selectedBackingEntity = createOrgGitlabGroupFixture(
          'gitlab-org/gitter'
        );
      });
      expect(wrapper.element).toMatchSnapshot();
    });

    it('clicking change moves back to backing entity step', () => {
      context.hasProvider.mockImplementation(provider => {
        if (provider === 'gitlab') {
          return true;
        }
      });

      const { wrapper, stubbedActions } = mount(StepMain, {}, store => {
        store.state.createCommunity.selectedBackingEntity = createOrgGitlabGroupFixture(
          'gitlab-org/gitter'
        );
      });

      wrapper.find({ ref: 'changeBackingEntityLink' }).trigger('click');

      expect(stubbedActions.createCommunity.moveToStep).toHaveBeenCalledWith(
        expect.anything(),
        CREATE_COMMUNITY_STEP_BACKING_ENTITY_GITLAB,
        undefined
      );
    });

    it('clicking badger checkbox changes allowBadger', () => {
      context.hasProvider.mockImplementation(provider => {
        if (provider === 'github') {
          return true;
        }
      });

      const { wrapper, stubbedActions } = mount(StepMain, {}, store => {
        store.state.createCommunity.allowBadger = true;
        store.state.createCommunity.selectedBackingEntity = createRepoGithubRepoFixture(
          'gitterhq/gitter'
        );
      });

      wrapper.find({ ref: 'allowBadgerCheckbox' }).trigger('click');

      expect(stubbedActions.createCommunity.setAllowBadger).toHaveBeenCalledWith(
        expect.anything(),
        false,
        undefined
      );
    });
  });

  describe('submit button', () => {
    it('submit loading user matches snapshot', () => {
      const { wrapper } = mount(StepMain, {}, store => {
        store.state.createCommunity.communitySubmitRequest.loading = true;
      });
      expect(wrapper.element).toMatchSnapshot();
    });
    it('submit error user matches snapshot', () => {
      const { wrapper } = mount(StepMain, {}, store => {
        store.state.createCommunity.communitySubmitRequest.error = new Error(
          'My fake request failed'
        );
      });
      expect(wrapper.element).toMatchSnapshot();
    });

    it('clicking submit', () => {
      const { wrapper, stubbedActions } = mount(StepMain, {});
      wrapper.find({ ref: 'submitButton' }).trigger('click');

      expect(stubbedActions.createCommunity.submitCommunity).toHaveBeenCalledWith(
        expect.anything(),
        undefined,
        undefined
      );
    });
  });
});
