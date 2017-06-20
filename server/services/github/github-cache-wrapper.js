/*jshint globalstrict:true, trailing:false, unused:true, node:true */
'use strict';

var SnappyCache = require('snappy-cache');
var Q = require('q');
var redis = require('../../utils/redis');
var config = require('../../utils/config');

function getKeys(method, contextValues, args) {
  var arr = [method]
              .concat(contextValues)
              .concat(args);

  return arr
          .map(encodeURIComponent)
          .join(':');
}

function wrap(service, contextFunction) {
  if(!config.get('github:caching')) return service;

  var sc = new SnappyCache({ prefix: 'sc:', redis: redis.getClient(), ttl: 120 });

  Object.keys(service.prototype).forEach(function(value) {
    var v = service.prototype[value];

    if(typeof v !== 'function') return;

    var wrapped = function() {
      var self = this;
      var args = Array.prototype.slice.apply(arguments);
      var contextValues = contextFunction ? contextFunction.apply(self) : [];

      var key = getKeys(value, contextValues, args);
      var d = Q.defer();

      sc.lookup(key, function(cb) {
        var promise = v.apply(self, args);

        promise.nodeify(cb);
      }, d.makeNodeResolver());

      d.promise.then(function(x) {
        return x;
      });

      return d.promise;
    };

    service.prototype[value] = wrapped;
  }, {});

  return service;
}

module.exports = exports = wrap;