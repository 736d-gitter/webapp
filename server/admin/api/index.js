/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

module.exports = {
  install: function(app) {
    app.get('/api/v1/online', require('./online.js'));
    app.get('/api/v1/mobile', require('./mobile.js'));
    app.get('/api/v1/sockets', require('./sockets.js'));

    app.resource('api/v1/users', require('./users.js'));
    app.resource('api/v1/pushdevices', require('./pushdevices.js'));
  }
};