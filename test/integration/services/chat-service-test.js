/*jslint node: true, unused:true */
/*global describe:true, it: true, before:true */
"use strict";

var testRequire = require('../test-require');

var chatService = testRequire('./services/chat-service');
var fixtureLoader = require('../test-fixtures');
var assert = require('assert');


describe('chatService', function() {

  var blockTimer = require('../block-timer');
  before(blockTimer.on);
  after(blockTimer.off);

  var fixture = {};
  before(fixtureLoader(fixture, {
    user1: {},
    troupe1: {users: ['user1']},
    message1: {
      user: 'user1',
      troupe: 'troupe1',
      text: 'old_message',
      sent: new Date("01/01/2014")
    },
    message2: {
      user: 'user1',
      troupe: 'troupe1',
      text: 'new_message',
      sent: new Date()
    }
  }));

  describe('updateChatMessage', function() {
    it('should update a recent chat message sent by the same user', function(done) {

      chatService.newChatMessageToTroupe(fixture.troupe1, fixture.user1, { text: 'Hello' }, function(err, chatMessage) {
        if(err) return done(err);

        var originalSentTime = chatMessage.sent;
        assert(!chatMessage.editedAt, 'Expected editedAt to be null');

        chatService.updateChatMessage(fixture.troupe1, chatMessage, fixture.user1, 'Goodbye', function(err, chatMessage2) {
          if(err) return done(err);

          assert(chatMessage2.text === 'Goodbye', 'Expected new text in message');
          assert(originalSentTime === chatMessage2.sent, 'Expected time to remain the same');
          assert(chatMessage2.editedAt, 'Expected edited at time to be populated');
          assert(chatMessage2.editedAt > chatMessage2.sent, 'Expected edited at time to be after sent time');

          done();
        });
      });
    });
  });

  describe('updateStatusMessage', function() {
    it('should update a recent `/me` status message sent by the same user ', function (done) {
      chatService.newChatMessageToTroupe(fixture.troupe1, fixture.user1, { text: '@walter is happy', status: true }, function (err, chatMessage) {
        if (err) return done(err);
        assert(chatMessage.text === '@walter is happy', 'Expected text to be the same');
        assert(chatMessage.status, 'Expected status to be set to true');
      });
      done();
    });
  });

  describe('Message entities', function() {
    it('should collect metadata from the message text', function(done) {

      chatService.newChatMessageToTroupe(fixture.troupe1, fixture.user1, { text: 'hey @mauro check https://trou.pe' }, function(err, chatMessage) {
        if(err) return done(err);

        assert(Array.isArray(chatMessage.urls), 'urls should be an array');
        assert(chatMessage.urls[0].url === 'https://trou.pe', 'url should be a valid TwitterText url entity');

        assert(Array.isArray(chatMessage.mentions), 'mentions should be an array');
        assert(chatMessage.mentions[0].screenName === 'mauro', 'mention should be a valid TwitterText mention entity');

        assert(chatMessage.metadataVersion !== 'undefined', 'there should be a metadataVersion');

        done();
      });

    });
  });

  describe('Finding messages', function() {
    var chat1, chat2, chat3;

    before(function(done) {
      return chatService.newChatMessageToTroupe(fixture.troupe1, fixture.user1, { text: 'A' })
        .then(function(chat) {
          chat1 = chat.id;
          return chatService.newChatMessageToTroupe(fixture.troupe1, fixture.user1, { text: 'B' });
        })
        .then(function(chat) {
          chat2 = chat.id;
          return chatService.newChatMessageToTroupe(fixture.troupe1, fixture.user1, { text: 'C' }) ;
        })
        .then(function(chat) {
          chat3 = chat.id;

          return chatService.findChatMessagesForTroupe(fixture.troupe1.id, { aroundId: chat2 });
        })
        .nodeify(done);
    });

    it('should find messages using aroundId', function(done) {
      return chatService.findChatMessagesForTroupe(fixture.troupe1.id, { aroundId: chat2 })
        .then(function(chats) {
          assert(chats.length >= 3);
          assert.strictEqual(chats.filter(function(f) { return f.id == chat1; }).length, 1);
          assert.strictEqual(chats.filter(function(f) { return f.id == chat2; }).length, 1);
          assert.strictEqual(chats.filter(function(f) { return f.id == chat3; }).length, 1);
        })
        .nodeify(done);
    });

    it('should find messages with skip', function(done) {
      return chatService.findChatMessagesForTroupe(fixture.troupe1.id, { skip: 1 })
        .then(function(chats) {
          assert.strictEqual(chats.filter(function(f) { return f.id == chat1; }).length, 1);
          assert.strictEqual(chats.filter(function(f) { return f.id == chat2; }).length, 1);

          // This message should not be there
          assert.strictEqual(chats.filter(function(f) { return f.id == chat3; }).length, 0);
        })
        .nodeify(done);
    });

    it('should not allow skip greater than 5000', function(done) {
      return chatService.findChatMessagesForTroupe(fixture.troupe1.id, { skip: 10000 })
        .then(function() {
          assert.ok(false);
        }, function(err) {
          assert.strictEqual(err.message, 'Skip is limited to 5000 items. Please use beforeId rather than skip. See https://developer.gitter.im');
        })
        .nodeify(done);
    });

    it('should find messages using beforeId', function(done) {
      return chatService.findChatMessagesForTroupe(fixture.troupe1.id, { beforeId: chat2 })
        .then(function(chats) {
          assert(chats.length >= 1);
          assert.strictEqual(chats.filter(function(f) { return f.id == chat1; }).length, 1);
          assert.strictEqual(chats.filter(function(f) { return f.id == chat2; }).length, 0);
          assert.strictEqual(chats.filter(function(f) { return f.id == chat3; }).length, 0);
        })
        .nodeify(done);
    });

    it('should find messages using beforeInclId', function(done) {
      return chatService.findChatMessagesForTroupe(fixture.troupe1.id, { beforeInclId: chat2 })
        .then(function(chats) {
          assert(chats.length >= 2);
          assert.strictEqual(chats.filter(function(f) { return f.id == chat1; }).length, 1);
          assert.strictEqual(chats.filter(function(f) { return f.id == chat2; }).length, 1);
          assert.strictEqual(chats.filter(function(f) { return f.id == chat3; }).length, 0);
        })
        .nodeify(done);
    });

    it('should find messages using afterId', function(done) {
      return chatService.findChatMessagesForTroupe(fixture.troupe1.id, { afterId: chat2 })
        .then(function(chats) {
          assert(chats.length >= 1);
          assert.strictEqual(chats.filter(function(f) { return f.id == chat1; }).length, 0);
          assert.strictEqual(chats.filter(function(f) { return f.id == chat2; }).length, 0);
          assert.strictEqual(chats.filter(function(f) { return f.id == chat3; }).length, 1);
        })
        .nodeify(done);
    });

  });

});
