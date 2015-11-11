/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var PushNotificationDevice = require("./persistence-service").PushNotificationDevice;
var crypto                 = require('crypto');
var Q                      = require('q');
var mongoUtils             = require('../utils/mongo-utils');
var debug                  = require('debug')('gitter:push-notification-service');
var uniqueIds              = require('mongodb-unique-ids');
var _                      = require('lodash');

function buffersEqual(a,b) {
  if (!Buffer.isBuffer(a)) return undefined;
  if (!Buffer.isBuffer(b)) return undefined;
  if (a.length !== b.length) return false;

  for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
  }

  return true;
}

function findAndRemoveDevicesWithDuplicateTokens(deviceId, deviceType, deviceToken, tokenHash) {
  return PushNotificationDevice.find({
      tokenHash: tokenHash,
      deviceType: deviceType
    })
    .exec()
    .then(function(devices) {
      var devicesToRemove = devices.filter(function(device) {
        // This device? Skip
        if(device.deviceId === deviceId) return false;

        // If the hashes are the same, we still need to check that the actual tokens are the same
        if(device.deviceToken && deviceToken) {
          if(!buffersEqual(device.deviceToken, deviceToken)) return false;
        }

        return true;
      });

      return Q.all(devicesToRemove.map(function(device) {
        debug('Removing unused device %s', device.deviceId);
        return device.remove();
      }));
    });
}

exports.registerDevice = function(deviceId, deviceType, deviceToken, deviceName, appVersion, appBuild, callback) {
  debug("Registering device %s", deviceId);
  var tokenHash = crypto.createHash('md5').update(deviceToken).digest('hex');

  return PushNotificationDevice.findOneAndUpdate(
    { deviceId: deviceId },
    {
      deviceId: deviceId,
      appleToken: deviceToken.toString('hex'),
      tokenHash: tokenHash,
      deviceType: deviceType,
      deviceName: deviceName,
      timestamp: new Date(),
      appVersion: appVersion,
      appBuild: appBuild,
      enabled: true
    },
    { upsert: true, new: true })
    .exec()
    .then(function(device) {
      // After we've update the device, look for other devices that have given us the same token
      // these are probably phones that have been reset etc, so we need to prune them
      return findAndRemoveDevicesWithDuplicateTokens(deviceId, deviceType, deviceToken, tokenHash)
        .thenResolve(device);
    })
    .nodeify(callback);
};

exports.registerAndroidDevice = function(deviceId, deviceName, registrationId, appVersion, userId, callback) {
  debug("Registering device %s", deviceId);
  var tokenHash = crypto.createHash('md5').update(registrationId).digest('hex');

  return PushNotificationDevice.findOneAndUpdate(
    { deviceId: deviceId },
    {
      userId: userId,
      deviceId: deviceId,
      androidToken: registrationId,
      tokenHash: tokenHash,
      deviceType: 'ANDROID',
      deviceName: deviceName,
      timestamp: new Date(),
      appVersion: appVersion,
      enabled: true
    },
    { upsert: true, new: true })
    .exec()
    .then(function(device) {
      // After we've update the device, look for other devices that have given us the same token
      // these are probably phones that have been reset etc, so we need to prune them
      return findAndRemoveDevicesWithDuplicateTokens(deviceId, 'ANDROID', registrationId, tokenHash)
        .thenResolve(device);
    })
    .nodeify(callback);
};

exports.deregisterAndroidDevice = function(registrationId) {
  return PushNotificationDevice.findOneAndRemove({ androidToken: registrationId }).exec();
};

exports.registerUser = function(deviceId, userId, callback) {
  return PushNotificationDevice.findOneAndUpdate(
    { deviceId: deviceId },
    { deviceId: deviceId, userId: userId, timestamp: new Date() },
    { upsert: true, new: true })
    .exec()
    .nodeify(callback);
};

var usersWithDevicesCache = null;
function getCachedUsersWithDevices() {
  if (usersWithDevicesCache) {
    return Q.resolve(usersWithDevicesCache);
  }

  return PushNotificationDevice.distinct('userId')
    .exec()
    .then(function(userIds) {
      usersWithDevicesCache = userIds.reduce(function(memo, userId) {
        memo[userId] = true;
        return memo;
      }, {});

      // Expire the cache after 60 seconds
      setTimeout(expireCachedUsersWithDevices, 60000);

      return usersWithDevicesCache;
    });
}

function expireCachedUsersWithDevices() {
  usersWithDevicesCache = null;
}

exports.findUsersWithDevices = function(userIds, callback) {
  return getCachedUsersWithDevices()
    .then(function(usersWithDevices) {
      return _.filter(userIds, function(userId) {
        // Only true if the user has a device...
        return usersWithDevices[userId];
      });
    })
    .nodeify(callback);
};

exports.findEnabledDevicesForUsers = function(userIds, callback) {
  userIds = mongoUtils.asObjectIDs(uniqueIds(userIds));
  return PushNotificationDevice
    .where('userId')['in'](userIds)
    .or([ { enabled: true }, { enabled: { $exists: false } } ]) // Exists false === enabled for old devices
    .exec()
    .then(function(devices) {
      return devices;
    })
    .nodeify(callback);
};

exports.findDeviceForDeviceId = function(deviceId, callback) {
  return PushNotificationDevice.findOne({ deviceId: deviceId })
    .exec()
    .nodeify(callback);
};

exports.testOnly = {
  expireCachedUsersWithDevices: expireCachedUsersWithDevices
};
