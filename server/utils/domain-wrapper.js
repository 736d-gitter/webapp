/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var domain = require('domain');
var winston = require('./winston');
var shutdown = require('./shutdown');


module.exports = function(app) {

  return function(req, res) {
    var reqd = domain.create();
    reqd.add(req);
    reqd.add(res);

    req.on('error', function(err) {
      winston.error('Request failed: ' + err, { message: err.message, name: err.name });

      if(!res.headersSent) {
        res.send(500);
      } else {
        res.end();
      }

      reqd.dispose();
    });

    reqd.on('error', function(err) {
      try {
        if(!res.headersSent) {
          res.send(500);
        } else {
          res.end();
        }

        winston.error('----------------------------------------------------------------');
        winston.error('-- A VeryBadThing has happened.');
        winston.error('----------------------------------------------------------------');
        winston.error('Uncaught exception: ' + err, { message: err.message, name: err.name });

        if(err.stack) {
          winston.error('' + err.stack);
        }

        winston.error('Uncaught exception' + err + ' forcing shutdown');
      } catch(e) {
        /* This might seem strange, but sometime just logging the error will crash your process a second time */
        try {
          console.log('The error handler crashed too');
        } catch(e) {
        }
      }

      try {
        reqd.dispose();
      } catch(e) {
        console.log('Failed to dispose of domain' + e);
      }

      try {
        shutdown.shutdownGracefully(11);
      } catch(e) {
        console.log('The shutdown handler crashed too');
      }


    });

    var args = arguments;

    reqd.run(function() {
      app.apply(null, args);
    });

  };

};