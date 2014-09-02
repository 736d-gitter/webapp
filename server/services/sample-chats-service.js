/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var chatService = require('./chat-service');
var restSerializer = require('../serializers/rest-serializer');
var Q = require('q');

var cachedSamples = null;
function getSamples() {
  if(cachedSamples) return Q.resolve(cachedSamples);

  return chatService.getRecentPublicChats()
    .then(function(chatMessage) {
      // Remove any duplicate users
      var users = {};
      return chatMessage.filter(function(chatMessage) {
        if(users[chatMessage.fromUserId]) {
          return false;
        }
        users[chatMessage.fromUserId] = true;
        return true;
      });
    })
    .then(function(sampleChatMessages) {
      var sampleChatStrategy = new restSerializer.SampleChatStrategy();
      var results = restSerializer.serialize(sampleChatMessages, sampleChatStrategy);

      cachedSamples = results;

      // Keep them cached for 30 seconds
      setTimeout(function() {
        cachedSamples = null;
      }, 30000);

      return results;
    });
}

module.exports = {
  getSamples: getSamples
};
