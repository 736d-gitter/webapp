#!/usr/bin/env node
/*jslint node: true */
"use strict";

var userService = require('../../server/services/user-service');
var assert = require('assert');
var shutdown = require('shutdown');
var pushNotificationGateway = require('../../server/gateways/push-notification-gateway');

var opts = require("nomnom").option('username', {
  position: 0,
  required: true,
  help: "username to look up e.g trevorah"
}).parse();

var fail = function(err) {
  console.error(err.stack);
  shutdown.shutdownGracefully();
};

userService.findByUsername(opts.username, function(err, id) {
  if (err) fail(err);

  var notification = {
    roomId: '000000000000000000000000',
    roomName: 'fake-room',
    message: 'fake-room \nfake-user: youve got a test push notification!',
    sound: 'notify.caf',
    link: '/mobile/chat#000000000000000000000000',
    badge: 99
  };

  return pushNotificationGateway.sendUserNotification([id], notification, function(err) {
    if (err) fail(err);

    console.log('waiting for queue to finish...');
    setTimeout(function() {
      shutdown.shutdownGracefully();
    }, 5000);
  });
});
