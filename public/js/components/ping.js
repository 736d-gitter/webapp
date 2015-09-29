"use strict";

var apiClient = require('components/apiClient');
var debug     = require('debug-proxy')('app:ping');

var PING_POLL = 10 * 60 * 1000;

// We use this to ensure that the users session does not time out
window.setInterval(function() {
  apiClient.web.get('/api_web/private/ping', undefined, {
      global: false
    })
    .fail(function(err) {
      debug('An error occurred pinging the server: %j', err);
    });
}, PING_POLL);
