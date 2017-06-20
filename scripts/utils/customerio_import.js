#!/usr/bin/env node
/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var nconf       = require('../../server/utils/config');
var winston     = require('../../server/utils/winston');
var persistence = require("../../server/services/persistence-service");
var shutdown    = require('../../server/utils/shutdown');


function getAllUsers(callback) {
  persistence.User.find(function (err, users) {
    if (err) console.log(err);
    callback("",users);
  });
}

getAllUsers(function(err, users) {

  if (nconf.get("stats:customerio:enabled")) {

    var CustomerIO = require('customer.io');
    var cio = CustomerIO.init(nconf.get("stats:customerio:siteId"), nconf.get("stats:customerio:key"));

    winston.verbose("[customerIO] Importing users: ", users.length);

    users.forEach(function(user) {
      var firstName = user.displayName ? user.displayName.split(' ')[0] : 'User';
      var createdAt = new Date(user._id.getTimestamp().getTime());

      var cio_properties = {
        first_name: firstName,
        created_at: createdAt.toISOString(),
        email:      user.email,
        name:       user.displayName,
        username:   user.username,
        status:     user.status
      };

      if (user.email.indexOf("troupetest.local") == -1) cio.identify(user.id, user.email, cio_properties);
    });
  }

  shutdown.shutdownGracefully();

});

