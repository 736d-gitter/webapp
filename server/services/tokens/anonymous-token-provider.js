'use strict';

var random     = require('../../utils/random');
var mongoUtils = require('../../utils/mongo-utils');
var crypto     = require('crypto');

var password   = 'soapP2igs1Od2gen';

function encrypt(tokenPair) {
  var cipher = crypto.createCipher('aes128', password);
  return cipher.update(tokenPair, 'ascii', 'base64') + cipher.final('base64');
}

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
    if (userId) return callback();

    return random.generateShortToken()
      .then(function(token) {
        // Anonymous tokens start with a `$`
        var tokenPair = token.substring(0, 4) + clientId;
        return "$" + encrypt(tokenPair);
      })
      .nodeify(callback);
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
