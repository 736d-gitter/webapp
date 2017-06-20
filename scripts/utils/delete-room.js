#!/usr/bin/env node
/*jslint node: true, unused:true */
"use strict";

var shutdown = require('shutdown');
var roomService = require('../../server/services/room-service');
var troupeService = require('../../server/services/troupe-service');
var Promise = require('bluebird');

require('../../server/event-listeners').install();

var opts = require("nomnom")
   .option('uri', {
      abbr: 'u',
      required: true,
      help: 'Uri of the room to delete'
   })
   .parse();

var readline = require('readline');

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

return troupeService.findByUri(opts.uri)
  .then(function(room) {
    return new Promise(function(resolve, reject) {
      rl.question("Are you sure you want to delete " + room.uri + " with " + room.userCount + " users in it? (yes/no)", function(answer) {
        rl.close();
        console.dir(answer);

        if(answer === 'yes') {
          resolve(room);
        } else {
          reject(new Error("Answered no"));
        }
      });

    });
  })
  .then(function(room) {
    return roomService.deleteRoom(room);
  })
  .then(function() {
    console.log('DONE. finishing up.');
  })
  .delay(5000)
  .then(function() {
    shutdown.shutdownGracefully();
  })
  .catch(function(err) {
    console.error('Error: ' + err, err);
    console.log(err.stack);
    shutdown.shutdownGracefully(1);
  })
  .done();
