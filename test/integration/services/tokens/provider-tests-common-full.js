'use strict';

var testRequire = require('../../test-require');
var mongoUtils = testRequire('./utils/mongo-utils');
var assert = require('assert');
var testRequire = require('../../test-require');
var persistenceService = testRequire('./services/persistence-service');

module.exports = function(underTest) {

  describe('non-anonymous', function() {
    var userId, clientId;

    beforeEach(function() {
      userId = mongoUtils.getNewObjectIdString() + "";
      clientId = mongoUtils.getNewObjectIdString() + "";
    });

    it('should create tokens for user-clients that do not exist', function(done) {
      underTest.getToken(userId, clientId, function(err, token) {
        if (err) return done(err);
        assert(token);
        done();
      });
    });

    it('should not validate tokens that do not exist', function(done) {
      underTest.validateToken("test" + Math.random(), function(err, userClient) {
        if (err) return done(err);
        assert(!userClient);
        done();
      });
    });

    it('should find tokens that have been cached', function(done) {
      underTest.getToken(userId, clientId, function(err, token2) {
        if (err) return done(err);

        underTest.validateToken(token2, function(err, userClient) {
          if (err) return done(err);

          assert(Array.isArray(userClient));
          // Deep equals freaks out with mongo ids
          assert.strictEqual(userId, "" + userClient[0]);
          assert.strictEqual(clientId, "" + userClient[1]);
          done();
        });

      });
    });

    it('should reuse the same tokens', function(done) {
      underTest.getToken(userId, clientId, function(err, token2) {
        if (err) return done(err);

        underTest.getToken(userId, clientId, function(err, token3) {
          if (err) return done(err);
          assert.strictEqual(token2, token3);
          done();
        });

      });

    });

    it('should not find tokens that have been deleted', function(done) {
      underTest.getToken(userId, clientId, function(err, token2) {
        if (err) return done(err);

        underTest.deleteToken(token2, function(err) {
          if(err) return done(err);

          underTest.getToken(userId, clientId, function(err, token3) {
            if (err) return done(err);
            assert(token2 != token3);

            underTest.validateToken(token2, function(err, userClient) {
              if (err) return done(err);
              assert(!userClient);

              underTest.validateToken(token3, function(err, userClient) {
                if (err) return done(err);

                assert(Array.isArray(userClient));
                // Deep equals freaks out with mongo ids
                assert.strictEqual(userId, "" + userClient[0]);
                assert.strictEqual(clientId, "" + userClient[1]);

                done();
              });
            });
          });
        });

      });

    });

  });


  describe('anonymous', function() {
    var clientId;

    beforeEach(function() {
      clientId = mongoUtils.getNewObjectIdString() + "";
    });

    it('should create tokens for user-clients that do not exist', function(done) {
      underTest.getToken(null, clientId, function(err, token) {
        if (err) return done(err);
        assert(token);
        done();
      });
    });

    it('should find tokens that have been cached', function(done) {
      underTest.getToken(null, clientId, function(err, token2) {
        if (err) return done(err);
        assert(token2);
        done();
      });
    });

    it('should not reuse the same tokens', function(done) {
      underTest.getToken(null, clientId, function(err, token2) {
        if (err) return done(err);

        underTest.getToken(null, clientId, function(err, token3) {
          if (err) return done(err);
          assert(token2 != token3);
          done();
        });

      });

    });

    it('should not find tokens that have been deleted', function(done) {
      underTest.getToken(null, clientId, function(err, token2) {
        if (err) return done(err);

        underTest.deleteToken(token2, function(err) {
          if(err) return done(err);

          underTest.getToken(null, clientId, function(err, token3) {
            if (err) return done(err);
            assert(token2 != token3);

            underTest.validateToken(token2, function(err, userClient) {
              if (err) return done(err);
              assert(!userClient);

              done();
            });
          });
        });

      });

    });

    it('should handle legacy persisted tokens during the transition period #slow', function(done) {
      this.setTimeout(4000);
      return persistenceService.OAuthAccessToken.findOneAndUpdate(
        { userId: null, clientId: clientId },
        {
          $setOnInsert: {
            token: 'test-' + Math.random() + Date.now(),
            clientId: clientId,
            userId: null,
            expires: new Date(Date.now() + 100000)
          }
        },
        {
          upsert: true
        }, function(err, result) {
          if (err) return done(err);

          var token = result.token;
          underTest.validateToken(token, function(err, userClient) {
            if (err) return done(err);

            assert(Array.isArray(userClient));
            // Deep equals freaks out with mongo ids
            assert.strictEqual(null, userClient[0]);
            assert.strictEqual(clientId, "" + userClient[1]);
            done();
          });

        });

    });

  });
};

