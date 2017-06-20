"use strict";

var _ = require('lodash');
var shutdown = require('shutdown');
var intercom = require('gitter-web-intercom');
var IntercomStream = require('../../server/utils/intercom-stream');

var stream = new IntercomStream({ client: intercom.client, key: 'segments'}, function() {
  return intercom.client.segments.list()
});

stream
  .on('data', function(segment) {
    console.log(segment.id, segment.name);
  })
  .on('end', function() {
    shutdown.shutdownGracefully();
  })
  .on('error', function die(error) {
    console.error(error);
    console.error(error.stack);
    shutdown.shutdownGracefully();
  });



