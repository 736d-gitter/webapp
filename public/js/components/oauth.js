/*jshint strict:true, undef:true, unused:strict, browser:true *//* global define:false */
define([
  'utils/context'
], function(context) {
  "use strict";

  var authToken = context.env('accessToken');
  if(!authToken) return;

  var XHR = window.XMLHttpRequest;

  var open = XHR.prototype.open;

  XHR.prototype.open = function(method, url, async, user, pass) {
      open.call(this, method, url, async, user, pass);

      if(url && url.charAt(0) === '/' && url.indexOf('/repo/') !== 0 && url.indexOf('/js/') !== 0) {
        // Dont pass the auth-token out
        this.setRequestHeader('Authorization', 'Bearer ' + authToken);
      }

  };


});
