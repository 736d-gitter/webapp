'use strict';

process.env.DISABLE_API_LISTEN = '1';

var Promise = require('bluebird');
var assert = require('assert');
var fixtureLoader = require('gitter-web-test-utils/lib/test-fixtures');

describe('reply-api', function() {
  var app, request;

  before(function() {
    request = require("supertest-as-promised")(Promise);
    app = require('../../server/api');
  });

  var fixture = fixtureLoader.setup({
    user1: {
      accessToken: 'web-internal'
    },
    forum1: {
      securityDescriptor: {
        extraAdmins: ['user1']
      }
    },
    category1: {
      forum: 'forum1'
    },
    topic1: {
      user: 'user1',
      forum: 'forum1',
      category: 'category1'
    },
    reply1: {
      user: 'user1',
      forum: 'forum1',
      topic: 'topic1'
    },
    comment1: {
      user: 'user1',
      forum: 'forum1',
      topic: 'topic1',
      reply: 'reply1'
    }
  });

  it('GET /v1/forums/:forumId/topics/:topicId/replies', function() {
    return request(app)
      .get('/v1/forums/' + fixture.forum1.id + '/topics/' + fixture.topic1.id + '/replies')
      .set('x-access-token', fixture.user1.accessToken)
      .expect(200)
      .then(function(result) {
        var replies = result.body;

        var reply = replies.find(function(r) {
          return r.id === fixture.reply1.id;
        });
        assert.strictEqual(reply.id, fixture.reply1.id);
        assert.strictEqual(reply.comments.length, 1);
      });
  });

  it('GET /v1/forums/:forumId/topics/:topicId/replies/:replyId', function() {
    return request(app)
      .get('/v1/forums/' + fixture.forum1.id + '/topics/' + fixture.topic1.id + '/replies/' + fixture.reply1.id)
      .set('x-access-token', fixture.user1.accessToken)
      .expect(200)
      .then(function(result) {
        var reply = result.body;
        assert.strictEqual(reply.id, fixture.reply1.id);
        assert.strictEqual(reply.comments.length, 1);
      });
  });

  it('PATCH /v1/forums/:forumId/topics/:topicId/replies/:replyId', function() {
    var update = {
      text: '**hello**',
    };
    return request(app)
      .patch('/v1/forums/' + fixture.forum1.id + '/topics/' + fixture.topic1.id + '/replies/' + fixture.reply1.id)
      .send(update)
      .set('x-access-token', fixture.user1.accessToken)
      .expect(200)
      .then(function(result) {
        var reply = result.body;

        assert.strictEqual(reply.body.text, update.text);
        assert.strictEqual(reply.body.html, '<strong>hello</strong>');
      });
  });

  it('POST /v1/forums/:forumId/topics/:topicId/replies', function() {
    return request(app)
      .post('/v1/forums/' + fixture.forum1.id + '/topics/' + fixture.topic1.id + '/replies')
      .send({
        text: 'I am a reply.'
      })
      .set('x-access-token', fixture.user1.accessToken)
      .expect(200)
      .then(function(result) {
        var reply = result.body;
        assert.strictEqual(reply.body.text, 'I am a reply.');
      });
  });



  it('GET /v1/forums/:forumId/topics/:topicId/replies/:replyId/subscribers', function() {
    return request(app)
      .get('/v1/forums/' + fixture.forum1.id + '/topics/' + fixture.topic1.id + '/replies/' + fixture.reply1.id + '/subscribers')
      .set('x-access-token', fixture.user1.accessToken)
      .expect(200)
      .then(function(result) {
        var body = result.body;
        assert(Array.isArray(body))
      });
  });

  it('POST /v1/forums/:forumId/topics/:topicId/replies/:replyId/subscribers', function() {
    return request(app)
      .post('/v1/forums/' + fixture.forum1.id + '/topics/' + fixture.topic1.id + '/replies/' + fixture.reply1.id + '/subscribers')
      .send({
      })
      .set('x-access-token', fixture.user1.accessToken)
      .expect(200)
      .then(function(result) {
        var body = result.body;
        assert.strictEqual(body.id, fixture.user1.id)
      });
  });

  it('DELETE /v1/forums/:forumId/topics/:topicId/replies/:replyId/subscribers', function() {
    return request(app)
      .del('/v1/forums/' + fixture.forum1.id + '/topics/' + fixture.topic1.id + '/replies/' + fixture.reply1.id + '/subscribers/' + fixture.user1.id)
      .set('x-access-token', fixture.user1.accessToken)
      .expect(204)
  });


});
