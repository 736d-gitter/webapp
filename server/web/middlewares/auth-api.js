/*jshint globalstrict: true, trailing: false, unused: true, node: true */
"use strict";

var passport    = require("passport");
var rateLimiter = require('./rate-limiter');
var logoutDestroyTokens = require('./logout-destroy-tokens');

function ensureLoggedIn(req, res, next) {
  /* Bearer strategy must return a user. If the user is { _anonymous: true }, it should be null */
  if (req.user && req.user._anonymous) {
    req.user = null;
  }

  if(req.user && req.user.isMissingTokens()) {
    return logoutDestroyTokens(req, res, next);
  }

  next();
}

module.exports = [
  passport.authenticate('bearer', { session: false, failWithError: true }),
  ensureLoggedIn,
  rateLimiter
];
