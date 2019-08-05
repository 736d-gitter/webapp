const mount = require('../../__test__/vuex-mount');
const momentTimezone = require('moment-timezone');
const { createSerializedMessageFixture } = require('../../__test__/fixture-helpers');
const { default: ChatItem } = require('./chat-item.vue');

describe('thread-message-feed chat-item', () => {
  momentTimezone.tz.setDefault('Europe/London');
  const defaultProps = {
    message: createSerializedMessageFixture(),
    useCompactStyles: false
  };

  describe('snapshot', () => {
    it('with default props', () => {
      const { wrapper } = mount(ChatItem, defaultProps);
      expect(wrapper.element).toMatchSnapshot();
    });
    it('showing item actions', () => {
      const { wrapper } = mount(ChatItem, { ...defaultProps, showItemActions: true });
      expect(wrapper.element).toMatchSnapshot();
    });
    it('compact styles', () => {
      const { wrapper } = mount(ChatItem, { ...defaultProps, useCompactStyles: true });
      expect(wrapper.element).toMatchSnapshot();
    });
  });
});
