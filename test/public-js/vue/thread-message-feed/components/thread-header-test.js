'use strict';

const mount = require('../../vuex-mount');
const {
  default: ThreadHeader
} = require('../../../../../public/js/vue/thread-message-feed/components/thread-header.vue');

describe('thread-message-feed thread-header', () => {
  it('matches snapshot', () => {
    const { wrapper } = mount(ThreadHeader);
    expect(wrapper.element).toMatchSnapshot();
  });
  it('close button calls toggleThreadMessageFeed action', () => {
    const { wrapper, stubbedActions } = mount(ThreadHeader);
    wrapper.find({ ref: 'close-button' }).trigger('click');

    expect(stubbedActions.threadMessageFeed.toggle).toHaveBeenCalledWith(
      expect.anything(),
      false,
      undefined
    );
  });
});