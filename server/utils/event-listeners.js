/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var installed = false;

exports.installLocalEventListeners = function() {
  if(!installed) {
    require('../web/bayeux-events-bridge').install();
    require('../services/notifications/notification-generator-service').install();
    require('../services/unread-item-service').install();
    require('../services/rich-message-generator').install();

    installed = true;
  }
};
