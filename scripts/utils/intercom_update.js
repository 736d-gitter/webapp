#!/usr/bin/env node
"use strict";

var nconf               = require('../../server/utils/config');
var persistence         = require("../../server/services/persistence-service");
var shutdown            = require('shutdown');
var async               = require('async');
var emailAddressService = require('../../server/services/email-address-service');

persistence.User.find(function (err, users) {
  if (err) {
    console.log("Error, coudln't fetch any users:", err);
    return;
  }

  if (!nconf.get("stats:intercom")) {
    console.error("Error, missing Intercom configuration");
    return;
  }

  var Intercom = require('intercom.io');
  var options = {
    apiKey: nconf.get("stats:intercom:key"),
    appId: nconf.get("stats:intercom:app_id")
  };

  var intercom = new Intercom(options);
  console.log("[intercom] Updating users: ", users.length);

  async.eachLimit(users, 20,
    function(user, callback){
      if (user.isActive()) {
        var created_at = new Date(user._id.getTimestamp());
        emailAddressService(user).nodeify(function(err, email) {
          if (err) console.log("Email error " + err);

          if (email) {
            intercom.createUser({
              "email" : email,
              "user_id" : user.id,
              "name" : user.displayName,
              "created_at" : created_at,
              "username" : user.username,
            },
            function(err, res) {
              if (err) console.log(err);
              console.log("Successfully updated: " + user.username);
              callback();
            });
          } else {
            console.log("Skipping " + user.username + " because they have an email address of " + user.email);
            callback();
          }

        });
      } else {
        console.log("Skipping " + user.username + " because they are " + user.state);
        callback();
      }
    },
    function(err){
      console.log("Shutting down gracefully");
      shutdown.shutdownGracefully();
    }
  );
});

