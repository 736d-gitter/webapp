'use strict';

process.env.DISABLE_API_LISTEN = '1';

var Promise = require('bluebird');
var assert = require('assert');
var fixtureLoader = require('gitter-web-test-utils/lib/test-fixtures');
var securityDescriptorService = require('gitter-web-permissions/lib/security-descriptor')

describe('group-api', function() {
  var app, request;

  fixtureLoader.ensureIntegrationEnvironment('#integrationUser1', 'GITTER_INTEGRATION_ORG');

  before(function() {
    request = require("supertest-as-promised")(Promise);
    app = require('../../server/api');
  });

  fixtureLoader.ensureIntegrationEnvironment(
      '#integrationUser1',
      'GITTER_INTEGRATION_ORG');

  var fixture = fixtureLoader.setup({
    deleteDocuments: {
      Group: [
        { lcUri: fixtureLoader.GITTER_INTEGRATION_USERNAME.toLowerCase() },
        { lcUri: fixtureLoader.GITTER_INTEGRATION_ORG.toLowerCase() },
        { lcUri: fixtureLoader.GITTER_INTEGRATION_COMMUNITY.toLowerCase() },
        { lcUri: 'repo-group' },
        { lcUri: '_repo-group' }
      ],
      Troupe: [
        { lcUri: fixtureLoader.GITTER_INTEGRATION_USERNAME.toLowerCase() + '/' + fixtureLoader.GITTER_INTEGRATION_REPO.toLowerCase() },
        { lcUri: fixtureLoader.GITTER_INTEGRATION_COMMUNITY.toLowerCase() + '/lobby' },
        { lcUri: fixtureLoader.GITTER_INTEGRATION_ORG.toLowerCase() + '/lobby' },
        { lcUri: 'repo-group/lobby' },
        { lcUri: '_repo-group/lobby' },
      ],
      Forum: [
        { lcUri: fixtureLoader.GITTER_INTEGRATION_USERNAME + '/topics' }
      ]
    },
    user1: '#integrationUser1',
    user2: {
      accessToken: 'web-internal'
    },
    group1: {
      uri: fixtureLoader.GITTER_INTEGRATION_USERNAME,
      lcUri: fixtureLoader.GITTER_INTEGRATION_USERNAME.toLowerCase(),
      securityDescriptor: {
        type: 'GH_USER',
        admins: 'GH_USER_SAME',
        linkPath: fixtureLoader.GITTER_INTEGRATION_USERNAME,
        extraAdmins: ['user1']
      }
    },
    troupe1: {
      security: 'PUBLIC',
      group: 'group1'
    },
    troupe2: {
      security: 'PRIVATE',
      group: 'group1'
    },
    troupe3: {
      group: 'group1',
      security: 'PRIVATE'
    }
  });

  it('GET /v1/groups', function() {
    return request(app)
      .get('/v1/groups')
      .set('x-access-token', fixture.user1.accessToken)
      .expect(200)
  });

  it('GET /v1/groups?type=admin for github user', function() {
    return request(app)
      .get('/v1/groups?type=admin')
      .set('x-access-token', fixture.user1.accessToken)
      .expect(200)
  });

  it('GET /v1/groups?type=admin for non-github user', function() {
    return request(app)
      .get('/v1/groups?type=admin')
      .set('x-access-token', fixture.user2.accessToken)
      .expect(200)
  });

  it('POST /v1/groups (new style community)', function() {
    return request(app)
      .post('/v1/groups')
      .send({ uri: fixtureLoader.GITTER_INTEGRATION_COMMUNITY, name: 'Test' })
      .set('x-access-token', fixture.user1.accessToken)
      .expect(200)
      .then(function(result) {
        var group = result.body;
        assert.strictEqual(group.uri, fixtureLoader.GITTER_INTEGRATION_COMMUNITY);
        assert.strictEqual(group.defaultRoom.uri, fixtureLoader.GITTER_INTEGRATION_COMMUNITY + '/Lobby');
      });
  });

  it('POST /v1/groups (github org based)', function() {
    return request(app)
      .post('/v1/groups')
      .send({
        uri: fixtureLoader.GITTER_INTEGRATION_ORG,
        name: 'Test',
        security: {
          type: 'GH_ORG',
          linkPath: fixtureLoader.GITTER_INTEGRATION_ORG
        }
      })
      .set('x-access-token', fixture.user1.accessToken)
      .expect(200)
      .then(function(result) {
        var group = result.body;
        assert.strictEqual(group.uri, fixtureLoader.GITTER_INTEGRATION_ORG);
        assert.strictEqual(group.defaultRoom.uri, fixtureLoader.GITTER_INTEGRATION_ORG + '/Lobby');
      });
  });

  it('POST /v1/groups (github repo based)', function() {
    return request(app)
      .post('/v1/groups')
      .send({
        name: 'Repo Group',
        // Adding an _ in here otherwise the test might fail with a 409 if a
        // user ever signs up to GitHub with that name before we split away
        // from GitHub. See fixtureLoader.GITTER_INTEGRATION_COMMUNITY too.
        uri: '_Repo-Group',
        providers: ['github'],
        addBadge: true,
        security: {
          type: 'GH_REPO',
          linkPath: fixtureLoader.GITTER_INTEGRATION_REPO_FULL
        }
      })
      .set('x-access-token', fixture.user1.accessToken)
      .expect(200)
      .then(function(result) {
        var group = result.body;
        assert.strictEqual(group.uri, '_Repo-Group');
        var room = group.defaultRoom;
        assert.strictEqual(room.uri, '_Repo-Group/Lobby');
        assert.deepEqual(room.providers, ['github']);
      });
  });

  it('GET /v1/groups/:groupId/rooms', function() {
    return request(app)
      .get('/v1/groups/' + fixture.group1.id + '/rooms')
      .set('x-access-token', fixture.user1.accessToken)
      .expect(200)
      .then(function(result) {
        var rooms = result.body;

        assert(rooms.some(function(r) {
          return r.id === fixture.troupe1.id;
        }));

        assert(rooms.every(function(r) {
          return r.id !== fixture.troupe2.id;
        }));

        assert(rooms.every(function(r) {
          return r.id !== fixture.troupe3.id;
        }));

        assert.strictEqual(result.body.length, 1);
      })
  });

  it('POST /v1/groups/:groupId/rooms with GH_REPO security', function() {
    return request(app)
      .post('/v1/groups/' + fixture.group1.id + '/rooms')
      .send({
        name: fixtureLoader.GITTER_INTEGRATION_REPO,
        topic: 'all about testing',
        providers: ['github'],
        security: {
          security: 'PRIVATE',
          type: 'GH_REPO',
          linkPath: fixtureLoader.GITTER_INTEGRATION_USERNAME + '/' + fixtureLoader.GITTER_INTEGRATION_REPO
        }
      })
      .set('x-access-token', fixture.user1.accessToken)
      .expect(200)
      .then(function(result) {
        var room = result.body;
        assert.strictEqual(room.providers.length, 1);
        assert.strictEqual(room.providers[0], 'github');
      });
  });

  it('POST /v1/groups/:groupId/rooms with PRIVATE GROUP security', function() {
    return request(app)
      .post('/v1/groups/' + fixture.group1.id + '/rooms')
      .send({
        name: fixtureLoader.generateUri(),
        topic: 'all about testing',
        security: {
          security: 'PRIVATE',
          type: 'GROUP',
        }
      })
      .set('x-access-token', fixture.user1.accessToken)
      .expect(200)
      .then(function(result) {
        var room = result.body;
        assert.strictEqual(room.groupId, fixture.group1.id);
        assert.strictEqual(room.public, false);
        assert.deepEqual(room.backend, {
          type: 'GROUP'
        });

        return securityDescriptorService.room.findById(room.id);
      })
      .then(function(descriptor) {
        assert.strictEqual(String(descriptor.internalId), fixture.group1.id);
        assert.strictEqual(descriptor.members, 'INVITE');
        assert.strictEqual(descriptor.public, false);
        assert.strictEqual(descriptor.admins, 'GROUP_ADMIN');
        assert.strictEqual(descriptor.type, 'GROUP');
      });
  });

  it('POST /v1/groups/:groupId/rooms with INHERITED GROUP security', function() {
    return request(app)
      .post('/v1/groups/' + fixture.group1.id + '/rooms')
      .send({
        name: fixtureLoader.generateUri(),
        topic: 'all about testing',
        security: {
          security: 'INHERITED',
          type: 'GROUP',
        }
      })
      .set('x-access-token', fixture.user1.accessToken)
      .expect(200)
      .then(function(result) {
        var room = result.body;
        assert.strictEqual(room.groupId, fixture.group1.id);
        assert.strictEqual(room.public, false);
        assert.deepEqual(room.backend, {
          type: 'GROUP'
        });

        return securityDescriptorService.room.findById(room.id);
      })
      .then(function(descriptor) {
        assert.strictEqual(String(descriptor.internalId), fixture.group1.id);
        assert.strictEqual(descriptor.members, 'INVITE_OR_ADMIN');
        assert.strictEqual(descriptor.public, false);
        assert.strictEqual(descriptor.admins, 'GROUP_ADMIN');
        assert.strictEqual(descriptor.type, 'GROUP');

      });
  });

  it('PUT /v1/groups/:groupId with forum: {...}', function() {
    return request(app)
      .put('/v1/groups/' + fixture.group1.id)
      .send({
        forum: {
          tags: ['monkey', 'banana'],
          categories: ['General', 'Announcements', 'FAQ']
        }
      })
      .set('x-access-token', fixture.user1.accessToken)
      .expect(200)
      .then(function(result) {
        var group = result.body;
        assert.ok(group.forumId);
      });
  });

  it('GET /v1/groups/:groupId/suggestedRooms', function() {
    return request(app)
      .get('/v1/groups/' + fixture.group1.id + '/suggestedRooms')
      .set('x-access-token', fixture.user1.accessToken)
      .expect(200)
      .then(function(result) {
        // For now, this is a very loose test, to prove
        // https://github.com/troupe/gitter-webapp/pull/2067
        // We can extend it later
        var suggestions = result.body;
        assert(Array.isArray(suggestions));
        assert(suggestions.length > 0);
        suggestions.forEach(function(suggestion) {
          assert(suggestion.hasOwnProperty('uri'));
          assert(suggestion.hasOwnProperty('avatarUrl'));
          assert(suggestion.hasOwnProperty('userCount'));
          assert(suggestion.hasOwnProperty('tags'));
          assert(suggestion.hasOwnProperty('description'));
          assert(suggestion.hasOwnProperty('exists'));
          assert(suggestion.exists === true && suggestion.id || suggestion.exists === false && !suggestion.id);
        });
      });
  });
});
