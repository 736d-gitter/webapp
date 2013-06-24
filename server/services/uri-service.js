/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var userService = require('./user-service');
var troupeService = require('./troupe-service');
var Q = require('q');

/**
 * findUri - find what the URL belongs to
 * @param  {String}   uri
 * @param  {String or ObjectId}   userId
 * @param  {Function} callback
 * @return {promise}  one of the following values:
 *  { ownUrl: true },
 *  { oneToOne: true, troupe: x, otherUser: y },
 *  { troupe: troupe, group: true, access: true/false, invite: invite },
 *  { notFound: true }
 */
exports.findUri = function(uri, userId, callback) {
  uri = uri.toLowerCase();

  // TODO add some caching

  return Q.all([
    userService.findByUsername(uri)
      .then(function(user) {
        // If we didn't match anything hopefully its a troupe
        if(!user) return null;

        // Is this the users own site?
        if(user.id == userId) {
          return { ownUrl: true };
        }

        return troupeService.findOrCreateOneToOneTroupe(userId, user.id)
          .spread(function(troupe, otherUser, invite) {
            return { oneToOne: true, troupe: troupe, otherUser: otherUser, access: !!troupe, invite: invite };

          });

      }),
    troupeService.findByUri(uri)
  ]).spread(function(oneToOneTroupeContext, troupe) {
      // One-to-one or self?
      if(oneToOneTroupeContext) {
        return oneToOneTroupeContext;
      }

      if(!troupe) {
        // Otherwise, nothing
        return { notFound: true };
      }

      if(troupeService.userIdHasAccessToTroupe(userId, troupe)) {
        return { troupe: troupe, group: true, access: true };
      }

      return troupeService.findUnusedInviteToTroupeForUserId(userId, troupe.id)
        .then(function(invite) {
          return { troupe: troupe, group: true, access: false, invite: invite };
        });


    }).nodeify(callback);

};