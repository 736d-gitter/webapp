/* jshint node:true */
"use strict";

var testRequire = require('./test-require');
var winston = testRequire('./utils/winston');

var timer;
var t;
var last;

module.exports = {
  on: function() {
    if(timer) return;

    // These are blocking, but once off
    testRequire('./serializers/rest-serializer').testOnly.eagerLoadStrategies();

    timer = true;
    last = Date.now();

    t = setInterval(function checkLoop() {
      var n = Date.now();
      if(n - last > 50) winston.warn('Block ' + (n - last) + 'ms');
      last = n;
    }, 10);

  },
  off: function() {
    timer = false;
    clearTimeout(t);
  },
  reset: function() {
    last = Date.now();
  }
};
