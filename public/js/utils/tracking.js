/*jshint strict:true, undef:true, unused:strict, browser:true *//* global define:false */
define([
  'jquery',
  'ga',
  'utils/context',
  'log!tracking',
  './mixpanel' // No ref
], function($, _gaq, context, log) {
  /*jshint unused:true */
  "use strict";

  if(!window.troupeTrackingId) {
    return {
      trackError: function(message, file, line) { log("An unexpected error occurred: '" + message + "' in " + file  + ":" + line, arguments); }
    };
  }

  _gaq.push(['_setAccount', window.troupeTrackingId]);
  _gaq.push(['_setAllowAnchor',true]);

  function trackPageView(routeName) {
    window.mixpanel.track('pageView', { pageName: routeName });
    _gaq.push(['_trackEvent', 'Route', routeName]);
  }

  function trackError(message, file, line) {
    window.mixpanel.track('jserror', { message: message, file: file, line: line } );
    _gaq.push(['_trackEvent', 'Error', message, file, line]);
  }

  if (window.troupeContext) {
    _gaq.push(['_setCustomVar',
        1,
        'userId',
        context.getUserId(),
        2 // Session level variable
     ]);
  }

  _gaq.push(['_trackPageview']);


  log("Clearing the hash");
  _gaq.push(function() {

    window.setTimeout(function() {
      log("Callback from GAQ");
      var hash = "" + window.location.hash;
      try {
        hash = hash.replace(/\butm_\w+=(\+|\w+|%\w\w|\-)*&?/g, "");
      } catch(e) {
        log(e);
      }

      window.location.hash = hash;
    }, 10);

  });

  $(document).on('track', function(e, routeName) {
    trackPageView(routeName);
  });

  return {
    trackError: trackError
  };
});



