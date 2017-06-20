'use strict';

var logger = require('gitter-web-env').logger;
var obfuscateToken = require('./obfuscate-token');
var _ = require('lodash');

function sanitizeHeaders(headers) {
  headers = headers || {};
  var cloned = _.clone(headers);

  if (cloned.Authorization) {
    var parts = cloned.Authorization.split(' ');
    if (parts.length == 2 && parts[0] == 'token') {
      cloned.Authorization = 'token ' + obfuscateToken(parts[1]);
    }
  }

  return cloned;
}

module.exports = function(options, callback, request) {
  request(options, function(error, response, body) {
    if (error || response && response.statusCode >= 400) {
      logger.error("Error while communicating with GitHub", {
        exception: error,
        // NOTE: this could potentially leak access_token, client_id or
        // client_secret query parameters. Ideally we would parse the url,
        // obfuscate those, and then format it back out again.
        method: options.method,
        uri: options.uri || options.url,
        requestHeaders: sanitizeHeaders(options.headers),
        statusCode: response && response.statusCode,
        responseHeaders: response && response.headers,
        message: body
      });
    }

    return callback(error, response, body);
  });
};
