/*jshint globalstrict:true, trailing:false, unused:true, node:true */
'use strict';

var env = require('../../utils/env');
var logger = env.logger;
var stats = env.stats;

module.exports = exports = function(options) {
  var maxRetries = options.maxRetries || 4;
  var exponentialBackoffFactor = options.exponentialBackoffFactor || 1;

  return function(options, callback, request) {
    /* Allow callers to disable retry */
    if (options.noRetry) {
      return request(options, callback);
    }

    function attempt() {
      var start = Date.now();

      stats.event('github.api.count');

      var uri = options.uri || options.url;
      logger.verbose('github.request', { uri: uri, method: options.method });

      request(options, function (error, response, body) {
        var duration = Date.now() - start;
        stats.responseTime('github.api.response.time', duration);

        if(error || response.statusCode >= 500) {
          retry++;

          if(retry <= maxRetries) {
            logger.error("Error while communicating with GitHub. Retrying in " + backoff + "ms", {
              statusCode: response && response.statusCode,
              uri: options.uri || options.url,
              error: error,
              message: body
            });

            stats.event('github.api.error.retry');

            backoff = backoff * (1 + exponentialBackoffFactor);
            return setTimeout(attempt, backoff);
          } else {
            stats.event('github.api.error.abort');
          }
        }

        return callback(error, response, body);
      });
    }

    var retry = 0;
    var backoff = 1;
    attempt(options, callback);
  };
};
