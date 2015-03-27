/* jshint node:true */
'use strict';

var speedy      = require ("speedy");
var persistence = require('../../server/services/persistence-service');
var chatService = require('../../server/services/chat-service');
var mongoose    = require('../../server/utils/mongoose-q');

var ObjectID = mongoose.mongo.ObjectID;


var userIds = ["54e4b1e56d46b9ea027e6e38", "54e4b1e56d46b9ea027e6e37"];

speedy.samples (10);

speedy.run ({
  withOr: function(done) {
    persistence.ChatMessage.find({ $or: [ { _id: userIds[0] }, { _id: userIds[1] } ] }).exec(done);
  },
  withIn: function(done) {
    persistence.ChatMessage.find({ _id: { $in: userIds } }).exec(done);
  },

});