/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var leanTroupeDao = require('./daos/lean-troupe-dao');
var billingService = require('./billing-service');
var StatusError = require('statuserror');
var moment = require('moment');
var SnappyCache = require('snappy-cache');
var env = require('../utils/env');
var Q = require('q');

var PLAN_TYPE_MESSAGE_HISTORY = {
  'unlimited': null,
  'silver': null,
  'bronze': [6, 'months'],
  'free-private': [1, 'days']
};


function getPlanType(troupeId) {
  return leanTroupeDao.findByIdRequired(troupeId, { githubType: 1, security: 1, uri: 1 })
    .then(function(room) {
      if(room.githubType === 'ONETOONE') return 'unlimited';

      if(room.security === 'PUBLIC') return 'unlimited';

      var uri = room.uri;
      if(!uri) throw new StatusError(500, 'Bad URI ' + uri);

      var userOrOrg = uri.split('/', 1).shift();

      return billingService.findActivePlan(userOrOrg)
        .then(function(plan) {
          var history;
          if(!plan) {
            return 'free-private'
          }

          return plan.plan;
        })
    })
}

var sc = new SnappyCache({ prefix: 'sc:rc:', redis: env.redis.getClient(), ttl: 120 });
function getPlanTypeCached(troupeId) {
  var d = Q.defer();

  sc.lookup('get-plan-type:' + troupeId, function(cb) {
    return getPlanType(troupeId)
      .nodeify(cb);
  }, d.makeNodeResolver());

  return d.promise;
}

/**
 * Returns the max message date for a troupe
 */
exports.getMaxHistoryMessageDate = function(troupeId) {
  return getPlanTypeCached(troupeId)
    .then(function(planType) {

      if(!PLAN_TYPE_MESSAGE_HISTORY.hasOwnProperty(planType))
        throw new StatusError(500, 'Unknown plan type ' + plan.plan);

      var history = PLAN_TYPE_MESSAGE_HISTORY[planType];

      if(!history) return null; // Unlimited history
      var unit = history[1];
      var value = history[0];

      return moment()
              .subtract(unit, value)
              .toDate();
    });
}
