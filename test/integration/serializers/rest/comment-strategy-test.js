"use strict";

var env = require('gitter-web-env');
var nconf = env.config;
var testRequire = require('../../test-require');
var fixtureLoader = require('gitter-web-test-utils/lib/test-fixtures');
var assertUtils = require('../../assert-utils')
var serialize = testRequire('./serializers/serialize');
var ReplyStrategy = testRequire('./serializers/rest/reply-strategy');


function makeHash() {
  var hash = {};
  for(var i = 0; i < arguments.length; i = i + 2) {
    hash[arguments[i]] = arguments[i + 1];
  }
  return hash;
}

describe('ReplyStrategy', function() {
  var blockTimer = require('../../block-timer');
  before(blockTimer.on);
  after(blockTimer.off);

  var fixture = fixtureLoader.setup({
    user1: {},
    forum1: {},
    category1: {
      forum: 'forum1'
    },
    topic1: {
      forum: 'forum1',
      category: 'category1',
      user: 'user1',
    },
    reply1: {
      forum: 'forum1',
      category: 'category1',
      user: 'user1',
      topic: 'topic1',
    },
    comment1: {
      forum: 'forum1',
      category: 'category1',
      user: 'user1',
      topic: 'topic1',
      reply: 'reply1',
      sent: new Date('2014-01-01T00:00:00.000Z')
    }
  });

  it('should serialize a comment', function() {
    var strategy = new ReplyStrategy();

    var comment = fixture.comment1;
    var user = fixture.user1;

    return serialize([comment], strategy)
      .then(function(s) {
        assertUtils.assertSerializedEqual(s, [{
          id: comment.id,
          body: {
            text: comment.text,
            html: comment.html,
          },
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl:  nconf.get('avatar:officialHost') + '/g/u/' + user.username,
          },
          sent: '2014-01-01T00:00:00.000Z',
          editedAt: null,
          lastModified: null,
          v: 1
        }])
      });
  });

  it("should serialize a reply with lookups=['user']", function() {
    var strategy = new ReplyStrategy({ lookups: ['user'] });

    var comment = fixture.comment1;
    var user = fixture.user1;

    return serialize([comment], strategy)
      .then(function(s) {
        assertUtils.assertSerializedEqual(s, {
          items: [{
            id: comment.id,
            body: {
              text: comment.text,
              html: comment.html,
            },
            user: fixture.user1.id,
            sent: '2014-01-01T00:00:00.000Z',
            editedAt: null,
            lastModified: null,
            v: 1
          }],
          lookups: {
            users: makeHash(fixture.user1.id, {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              avatarUrl:  nconf.get('avatar:officialHost') + '/g/u/' + user.username,
            })
          }
        })
      });
  });
});
