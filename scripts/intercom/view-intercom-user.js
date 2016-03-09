#!/usr/bin/env node
"use strict";

var _ = require('lodash');
var shutdown = require('shutdown');
var intercom = require('gitter-web-intercom');


var opts = require("nomnom")
   .option('id', {
      required: false,
      help: 'Intercom user id'
   })
   .option('user_id', {
      required: false,
      help: 'Mongo user id'
   })
   .option('email', {
      required: false
   })
   .parse();

if (!opts.id && !opts.user_id && !opts.email) {
  throw new Error("id, user_id or email required.");
}

intercom.client.users.find(opts)
  .then(function(response) {
    var user = response.body;
    console.log(user);
  })
  .then(function() {
    shutdown.shutdownGracefully();
  })
  .catch(function(err) {
    console.error(err);
    console.error(err.stack);
    shutdown.shutdownGracefully(1);
  });