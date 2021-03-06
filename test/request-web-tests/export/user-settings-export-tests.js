'use strict';

process.env.DISABLE_MATRIX_BRIDGE = '1';
process.env.DISABLE_API_LISTEN = '1';
process.env.DISABLE_API_WEB_LISTEN = '1';
process.env.TEST_EXPORT_RATE_LIMIT = 100;

const fixtureLoader = require('gitter-web-test-utils/lib/test-fixtures');
const assert = require('assert');
const request = require('supertest');

const app = require('../../../server/web');
const userSettingsService = require('gitter-web-user-settings');

describe('user-settings-export-api', function() {
  fixtureLoader.ensureIntegrationEnvironment('#oauthTokens');

  before(function() {
    if (this._skipFixtureSetup) return;
  });

  var fixture = fixtureLoader.setup({
    user1: {
      accessToken: 'web-internal'
    },
    userNoExport1: {
      accessToken: 'web-internal'
    }
  });

  it('GET /api_web/export/user/:user_id/user-settings.ndjson as same user gets data', async () => {
    await userSettingsService.setUserSettings(fixture.user1.id, 'test', 'foobar');
    await userSettingsService.setUserSettings(fixture.userNoExport1.id, 'test', 'noexport');

    return request(app)
      .get(`/api_web/export/user/${fixture.user1.id}/user-settings.ndjson`)
      .set('Accept', 'application/x-ndjson,application/json')
      .set('Authorization', `Bearer ${fixture.user1.accessToken}`)
      .expect(200)
      .then(function(result) {
        assert.strictEqual(
          result.text.split('\n').length,
          2,
          'includes 1 setting item (extra newline at the end)'
        );
        assert(result.text.includes('"test":"foobar"'), 'includes test user settings');
      });
  });
});
