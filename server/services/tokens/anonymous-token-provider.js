'use strict';

// TODO: delete this after 11 July 2017

var mongoUtils = require('gitter-web-persistence-utils/lib/mongo-utils');
var crypto = require('crypto');

var password = 'soapP2igs1Od2gen';

function decrypt(encrypted) {
  try {
    var decipher = crypto.createDecipher('aes128', password);
    return decipher.update(encrypted, 'base64', 'ascii') + decipher.final('ascii');
  } catch(e) {
    return null;
  }
}
module.exports = {
  getToken: function(userId, clientId, callback) {
    return callback();
  },

  validateToken: function(token, callback) {
    if (!token || token.charAt(0) !== '$') return callback();
    var encrypted = token.substring(1);
    var decrypted = decrypt(encrypted);

    if (!decrypted) return callback();

    var clientId = decrypted.substring(4);

    if (!mongoUtils.isLikeObjectId(clientId)) {
      return callback();
    }

    return callback(null, [null, clientId]);

  },

  cacheToken: function(userId, clientId, token, callback) {
    return callback();
  },

  deleteToken: function(token, callback) {
    return callback();
  },

  invalidateCache: function(callback) {
    return callback();
  }
};
