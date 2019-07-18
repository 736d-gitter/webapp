'use strict';

process.env.DISABLE_API_LISTEN = '1';

var Promise = require('bluebird');
var assert = require('assert');
var fixtureLoader = require('gitter-web-test-utils/lib/test-fixtures');
var groupService = require('gitter-web-groups/lib/group-service');

describe('user-orgs #slow', function() {
  var app, request;

  fixtureLoader.ensureIntegrationEnvironment(
    '#integrationUser1',
    'GITTER_INTEGRATION_ORG',
    '#oauthTokens'
  );

  before(function() {
    if (this._skipFixtureSetup) return;

    request = require('supertest-as-promised')(Promise);
    app = require('../../server/api');
  });

  var fixture = fixtureLoader.setup({
    deleteDocuments: {
      Group: [
        { 'sd.type': 'GH_ORG', 'sd.linkPath': fixtureLoader.GITTER_INTEGRATION_ORG },
        { lcUri: fixtureLoader.GITTER_INTEGRATION_COMMUNITY.toLowerCase() }
      ],
      Troupe: [
        { 'sd.type': 'GH_ORG', 'sd.linkPath': fixtureLoader.GITTER_INTEGRATION_ORG },
        { lcUri: fixtureLoader.GITTER_INTEGRATION_COMMUNITY.toLowerCase() + '/community' }
      ]
    },
    user1: '#integrationUser1'
  });

  it('GET /v1/user/:userId/orgs', function() {
    return request(app)
      .get('/v1/user/' + fixture.user1._id + '/orgs')
      .set('x-access-token', fixture.user1.accessToken)
      .expect(200)
      .then(function(result) {
        var orgs = result.body;

        assert(
          orgs.some(function(org) {
            return org.name === fixtureLoader.GITTER_INTEGRATION_ORG;
          })
        );
      });
  });

  it('GET /v1/user/:userId/orgs?type=unused', function() {
    return request(app)
      .get('/v1/user/' + fixture.user1._id + '/orgs?type=unused')
      .set('x-access-token', fixture.user1.accessToken)
      .expect(200)
      .then(function(result) {
        var orgs = result.body;

        assert(
          orgs.some(function(org) {
            return org.name === fixtureLoader.GITTER_INTEGRATION_ORG;
          })
        );

        // now try and add one and see if it is still in there
        // (should we do this via the API too? Going with groupService directly
        //  as it is faster to execute and which user took the linkPath is
        //  irrelevant)
        return groupService.createGroup(fixture.user1, {
          type: 'GH_ORG',
          name: fixtureLoader.GITTER_INTEGRATION_COMMUNITY,
          uri: fixtureLoader.GITTER_INTEGRATION_COMMUNITY,
          linkPath: fixtureLoader.GITTER_INTEGRATION_ORG
        });
      })
      .then(function() {
        return request(app)
          .get('/v1/user/' + fixture.user1._id + '/orgs?type=unused')
          .set('x-access-token', fixture.user1.accessToken)
          .expect(200);
      })
      .then(function(result) {
        var orgs = result.body;

        assert(
          orgs.every(function(org) {
            return org.name !== fixtureLoader.GITTER_INTEGRATION_ORG;
          })
        );
      });
  });
});
