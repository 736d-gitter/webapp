/*jslint node: true */
/*global describe:true, it: true */
"use strict";

var testRequire = require('../test-require');

var pushNotificationService = testRequire('./services/push-notification-service');
var persistenceService = testRequire('./services/persistence-service');

var assert = require("assert");

describe('push-notification-service', function() {
  describe('device registration', function() {
    it('should prune unused old devices', function(done) {
      var token = 'TESTTOKEN';

      pushNotificationService.registerDevice('DEVICE1', 'TEST', token, 'TESTDEVICE', '1.0.1', '122')
        .then(function() {
          // Different device, same token
          return pushNotificationService.registerDevice('DEVICE2', 'TEST', token, 'OTHERTESTDEVICE', '1.0.1', '122');
        })
        .then(function() {
          return persistenceService.PushNotificationDevice.findQ({ deviceType: 'TEST', deviceId: 'DEVICE1' });
        })
        .then(function(devices) {
          assert.equal(devices.length, 0);
        })
        .nodeify(done);
    });
  });

  describe('Notification Locking', function() {
    it('should lock user troupe pairs so that users dont get too many notifications', function(done) {
      var userId = 'TEST_USER1_' + Date.now();
      var troupeId = 'TEST_TROUPE1_' + Date.now();
      var startTime = Date.now();

      pushNotificationService.canLockForNotification(userId, troupeId, startTime, function(err, locked) {
        if(err) return done(err);
        assert.equal(locked, 1);

        pushNotificationService.canLockForNotification(userId, troupeId, startTime, function(err, locked) {
          if(err) return done(err);
          assert.equal(locked, 0);

          pushNotificationService.canUnlockForNotification(userId, troupeId, 1, function(err, st) {
            if(err) return done(err);

            assert.equal(st, startTime);

            pushNotificationService.canUnlockForNotification(userId, troupeId, 1, function(err, st) {
              if(err) return done(err);
              assert.equal(st, 0);

              done();

            });
          });
        });
      });
    });

   it('should handle notification resets', function(done) {
      var userId = 'TEST_USER1_' + Date.now();
      var troupeId = 'TEST_TROUPE1_' + Date.now();
      var startTime = Date.now();

      pushNotificationService.resetNotificationsForUserTroupe(userId, troupeId, function(err) {
        if(err) return done(err);

        pushNotificationService.canLockForNotification(userId, troupeId, startTime, function(err, locked) {
          if(err) return done(err);
          assert.equal(locked, 1);

          pushNotificationService.resetNotificationsForUserTroupe(userId, troupeId, function(err) {
            if(err) return done(err);

            pushNotificationService.canLockForNotification(userId, troupeId, startTime, function(err, locked) {
              if(err) return done(err);
              assert.equal(locked, 1);

              pushNotificationService.resetNotificationsForUserTroupe(userId, troupeId, function(err) {
                if(err) return done(err);

                pushNotificationService.canUnlockForNotification(userId, troupeId, 1, function(err, st) {
                  if(err) return done(err);
                  assert.equal(st, 0);

                  done();

                });
              });

            });
          });

        });
      });
    });

  });
});
