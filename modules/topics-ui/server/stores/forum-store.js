"use strict";

var _ = require('lodash');
var forumConstants = require('../../shared/constants/forum.js');

module.exports = function forumStore(initialData) {
  initialData = (initialData || {});

  var data = _.extend({}, initialData, {
    subscriptionState: initialData.subscribed ? forumConstants.SUBSCRIPTION_STATE_SUBSCRIBED : forumConstants.SUBSCRIPTION_STATE_UNSUBSCRIBED
  });
  delete data.subscribed;

  //Methods
  return {
    data: data,
    get: (key) => data[key],
    getForum: () => {
      return data;
    },
    getForumId: () => {
      return data.id;
    },
    getSubscriptionState: () => {
      return data.subscriptionState;
    },
    getForumIsAdmin: () => {
      return data.permissions && data.permissions.admin;
    },
  };
};
