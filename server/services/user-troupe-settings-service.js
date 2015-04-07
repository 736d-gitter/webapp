/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var persistence = require('./persistence-service');
var mongoUtils = require('../utils/mongo-utils');
var onMongoConnect = require('../utils/on-mongo-connect');
var assert = require('assert');
var Q = require('q');

exports.getUserSettings = function(userId, troupeId, settingsKey) {
  /* Not sure why mongoose isn't converting these */
  assert(mongoUtils.isLikeObjectId(userId));
  assert(mongoUtils.isLikeObjectId(troupeId));
  userId = mongoUtils.asObjectID(userId);
  troupeId = mongoUtils.asObjectID(troupeId);

  return persistence.UserTroupeSettings.findOneQ({ userId: userId, troupeId: troupeId }, 'settings.' + settingsKey, { lean: true })
    .then(function(uts) {
      if(!uts) return;
      if(!uts.settings) return;

      return uts.settings[settingsKey];
    });
};


exports.getMultiUserTroupeSettings = function(userTroupes, settingsKey) {
  if(!userTroupes.length) return Q.resolve({});

  var terms = userTroupes.map(function(userTroupe) {
    if(!mongoUtils.isLikeObjectId(userTroupe.userId) || !mongoUtils.isLikeObjectId(userTroupe.troupeId)) return;
    var userId = mongoUtils.asObjectID(userTroupe.userId);
    var troupeId = mongoUtils.asObjectID(userTroupe.troupeId);

    return { userId: userId, troupeId: troupeId };
  }).filter(function(f) {
    return !!f;
  });

  return persistence.UserTroupeSettings.findQ({ $or: terms }, 'userId troupeId settings.' + settingsKey, { lean: true })
    .then(function(utses) {
      var hash = utses.reduce(function(memo, uts) {
        memo[uts.userId + ':' + uts.troupeId] = uts.settings && uts.settings[settingsKey];
        return memo;
      }, {});

      return hash;
    });
};

exports.getUserTroupeSettingsForUsersInTroupe = function(troupeId, settingsKey, userIds) {
  if(!userIds.length) return Q.resolve({});

  return persistence.UserTroupeSettings.findQ({
      $and: [{
        troupeId: troupeId
      }, {
        userId: { $in: userIds }
      }]
    }, 'userId settings.' + settingsKey, { lean: true })
    .then(function(utses) {
      var hash = utses.reduce(function(memo, uts) {
        memo[uts.userId] = uts.settings && uts.settings[settingsKey];
        return memo;
      }, {});

      return hash;
    });
};


exports.getAllUserSettings = function(userId, troupeId) {
  /* Not sure why mongoose isn't converting these */
  assert(mongoUtils.isLikeObjectId(userId));
  assert(mongoUtils.isLikeObjectId(troupeId));
  userId = mongoUtils.asObjectID(userId);
  troupeId = mongoUtils.asObjectID(troupeId);

  return persistence.UserTroupeSettings.findOneQ({ userId: userId, troupeId: troupeId }, 'settings', { lean: true })
    .then(function(uts) {
      if(!uts) return;
      return uts.settings || {};
    });
};

exports.setUserSettings = function(userId, troupeId, settingsKey, settings) {
  assert(mongoUtils.isLikeObjectId(userId));
  assert(mongoUtils.isLikeObjectId(troupeId));

  userId = mongoUtils.asObjectID(userId);
  troupeId = mongoUtils.asObjectID(troupeId);

  var setOperation = { $set: { } };
  setOperation.$set['settings.' + settingsKey] = settings;
  var d = Q.defer();

  persistence.UserTroupeSettings.collection.update(
      { userId: userId, troupeId: troupeId },
      setOperation,
      { upsert: true },
      function(err) {
        if(err) return d.reject(err);
        return d.resolve();
      });

  return d.promise;
};

exports.setUserSettingsForUsersInTroupe = function(troupeId, userIds, settingsKey, settings) {
  if (!userIds.length) return Q.resolve();

  return onMongoConnect()
    .then(function() {
      var bulk = persistence.UserTroupeSettings.collection.initializeUnorderedBulkOp();

      var setOperation = { $set: { } };
      setOperation.$set['settings.' + settingsKey] = settings;

      troupeId = mongoUtils.asObjectID(troupeId);

      userIds.forEach(function(userId) {
        userId = mongoUtils.asObjectID(userId);
        bulk.find({ userId: userId, troupeId: troupeId }).upsert().updateOne(setOperation);
      });

      var d = Q.defer();
      bulk.execute(d.makeNodeResolver());
      return d.promise;
    });
};


// TODO: remove settings for users removed from troupes, from troupes that have been deleted etc
