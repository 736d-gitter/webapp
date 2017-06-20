/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var express = require('express');
var fs = require('fs');
var https = require('https');
var http = require('http');
var nconf = require('./utils/config');
var winston = require('./utils/winston');
var shutdown = require('./utils/shutdown');
var bayeux = require('./web/bayeux');

var app = express();
var server;

// if(nconf.get("ws:privateKeyFile")) {
//   var options = {
//     key: fs.readFileSync(nconf.get("ws:privateKeyFile")),
//     cert: fs.readFileSync(nconf.get("ws:certificateFile"))
//   };
//   winston.info("Starting https/wss service");
//   server = https.createServer(options, app);
// } else {
  winston.info("Starting http/ws service");
  server = http.createServer(app);
// }


var RedisStore = require('connect-redis')(express);
var sessionStore = new RedisStore();

require('./web/express').installSocket(app, server, sessionStore);

require('./web/passport').install();

app.get('/', function(req, res) {
  res.send('Nothing to see here. You must be lost.');
});

require('./utils/event-listeners').installLocalEventListeners();

var port = nconf.get('PORT') || nconf.get("ws:port");
var bindIp = nconf.get("ws:bindIp");

winston.info("Binding websockets service to " + bindIp + ":" + port);

bayeux.attach(server);

// Listen to the port
server.listen(port, bindIp);

var gracefullyClosing = false;
app.use(function(req, res, next) {
  if(!gracefullyClosing) return next();

  res.setHeader("Connection", "close");
  res.send(502, "Server is in the process of restarting");
});

shutdown.installUnhandledExceptionHandler();
shutdown.addHandler('websockets', 10, function(callback) {
  server.close(function() {
    callback();
  });
});


