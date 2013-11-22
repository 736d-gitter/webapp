/*jshint strict:true, undef:true, unused:strict, browser:true *//* global define:false */
define([
  'utils/context'
], function (context ) {
  "use strict";

  var hosts = context.env('cdns');
  var hostLength = hosts && hosts.length;
  var cdnPrefix = context.env('appVersion') ? "/_s/" + context.env('appVersion') : '';

  function cdnPassthrough(url) {
    return "/" + url;
  }

  function cdnSingle(url, options) {
    var nonrelative = options && options.nonrelative;

    var prefix = nonrelative ? "https://" : "//";
    if(options && options.notStatic === true) {
      return prefix + hosts[0] + "/" + url;
    }

    return prefix + hosts[0] + cdnPrefix + "/" + url;
  }

  function cdnMulti(url, options) {
    var x = 0;
    for(var i = 0; i < url.length; i = i + 3) {
      x = x + url.charCodeAt(i);
    }

    var host = hosts[x % hostLength];

    var nonrelative = options && options.nonrelative;
    var prefix = nonrelative ? "https://" : "//";

    if(options && options.notStatic === true) {
      return prefix + host + "/" + url;
    }

    return prefix + host + cdnPrefix + "/" + url;
  }

  if(!hostLength) {
    return cdnPassthrough;
  } else if(hostLength == 1) {
    return cdnSingle;
  } else {
    return cdnMulti;
  }

});
