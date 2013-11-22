/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

module.exports = {
  install: function(app) {
    app.post('/api/private/github_signup',
        require('./github-signup.js'));

    app.get('/api/private/health_check',
        require('./health-check.js'));

    // No auth for hooks yet
    app.post('/api/private/hook/:hash',
        require('./hooks'));
  }
};