/*jshint strict:true, undef:true, unused:strict, browser:true *//* global define:false */
define([
  'jquery',
  'utils/context',
  './realtime',
  'handlebars',
  'log!web-notifications',
  './notify' // No ref
], function($, context, realtime, handlebars, log){
  "use strict";

  var notifications = $('<div id="notification-center" class="notification-center"></div>').appendTo('body');

  if(context.isAuthed()) {
    // notifications for cross troupe chat messages
    realtime.subscribe('/user/' + context.getUserId(), function(message) {
      if (message.notification === 'user_notification') {

        if(message.troupeId && message.troupeId === context.getTroupeId()) {
          return;
        }

        // log("Got a user_notification event");
        var tmpl = handlebars.compile('<a href="{{link}}"><div class="notification-header">{{{title}}}</div><div class="notification-text">{{{text}}}</div></a>');
        notifications.notify({
          content: tmpl({
            link: message.link,
            title: message.title,
            text: message.text
          })
        });
      }
    });
  }

  $(document).on('app.version.mismatch', function() {
    notifications.notify({
      id: 'app-update',
      className: 'notification',
      content: "<a href=\"javascript:window.location.reload()\">There is a new version of the application. Please click here to refresh.</a>"
    });
  });

  // one notification when the connection to server is down
  // todo: this might also show when an invalid user operation is attempted.
  $(document).ajaxError(function(ev, jqxhr, settings /*, exception*/) {
    // for 401 unauthorized, refresh the page to log user's back in.

    if (jqxhr.status === 401) {
      return window.location.reload();
    }

    require(['utils/tracking'], function(tracking) {
      tracking.trackError("Ajax Error", settings.url, jqxhr.status);
    });

    notifications.notify({
      id: 'ajax-error',
      className: 'notification-error',
      content: "We're having problems communicating with the server at the moment...."
    });
  });

  // websocket notifications
  $(document).on('realtime:persistentOutage', function() {
    log('realtime:persistentOutage');
    notifications.notify({
      id: 'realtime-error',
      className: 'notification-error',
      content: "We're having problems with our realtime connection at present. Please stand-by",
      timeout: Infinity
      /* TODO: make this persistent and clear it when the persistentOutageCleared event occurs */
    });
  });

  $(document).on('realtime:persistentOutageCleared', function() {
    log('realtime:persistentOutageCleared');
    notifications.notify({
      id: 'realtime-error',
      action: 'hide'
    });
  });

  // stop notifications when a user navigates away from the page
  window.onbeforeunload = function() {
    $('#notification-center').hide();
  };
});
