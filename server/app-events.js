/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var events = require('events');

var winston = require('./utils/winston');
var redis = require('./utils/redis');
var client = redis.createClient();
var pubClient = redis.createClient();
var eventEmitter = new events.EventEmitter();
var localEventEmitter = new events.EventEmitter();
var shutdown = require('shutdown');

var subscriptions = {};

client.on("message", function (channel, message) {
  eventEmitter.emit(channel, JSON.parse(message));
});

function emit(event, data) {
  localEventEmitter.emit(event, data);
  pubClient.publish(event, JSON.stringify(data));
}

function logError(e) {
  //Error.captureStackTrace(e);
  winston.error("Appevent handler failed with error: " + e, { exception: e });
}

// Listen for system-wide events
function onRemote(event, callback) {
  if(!subscriptions[event]) {
    client.subscribe(event);

    subscriptions[event] = true;
  }

  eventEmitter.on(event, function(message) {
    try {
      callback(message);
    } catch(e) {
      logError(e);
    }
  });
}

// Listen to local-events only
function onLocalOnly(event, callback) {
  localEventEmitter.on(event, function(message) {
    try {
      callback(message);
    } catch(e) {
      logError(e);
    }
  });
}

function bind(on) {
  return {
    unreadRecalcRequired: function() {
      emit('unreadRecalcRequired', true);
    },

    onUnreadRecalcRequired: function(callback) {
      on('unreadRecalcRequired', callback);
    },


    newUnreadItem: function(userId, troupeId, items) {
      emit('newUnreadItem', {
        userId: userId,
        troupeId: troupeId,
        items: items
      });
    },

    onNewUnreadItem: function(callback) {
      on('newUnreadItem', callback);
    },


    unreadItemsRemoved: function(userId, troupeId, items) {
      emit('unreadItemRemoved', {
        userId: userId,
        troupeId: troupeId,
        items: items
      });
    },



    onUnreadItemsRemoved: function(callback) {
      on('unreadItemRemoved', callback);
    },

    troupeUnreadCountsChange: function(data) {
      emit('troupeUnreadCountsChange', data);
    },

    onTroupeUnreadCountsChange: function(callback) {
      on('troupeUnreadCountsChange', callback);
    },

    troupeMentionCountsChange: function(data) {
      emit('troupeMentionCountsChange', data);
    },

    onTroupeMentionCountsChange: function(callback) {
      on('troupeMentionCountsChange', callback);
    },

    userLoggedIntoTroupe: function(userId, troupeId) {
      emit('userLoggedIntoTroupe', { troupeId: troupeId, userId: userId });
    },

    onUserLoggedIntoTroupe: function(callback) {
      on('userLoggedIntoTroupe', callback);
    },

    userLoggedOutOfTroupe: function(userId, troupeId) {
      emit('userLoggedOutOfTroupe', { troupeId: troupeId, userId: userId });
    },

    onUserLoggedOutOfTroupe: function(callback) {
      on('userLoggedOutOfTroupe', callback);
    },

    // Deprecated
    newNotification: function(troupeId, userId, notificationText, notificationLink) {
      emit('newNotification', {
        troupeId: troupeId,
        userId: userId,
        notificationText: notificationText,
        notificationLink: notificationLink
      });
    },

    // Deprecated
    onNewNotification: function(callback) {
      on('newNotification', callback);
    },

    userNotification: function(options) {
      emit('userNotification',options);
    },

    // Deprecated
    onUserNotification: function(callback) {
      on('userNotification', callback);
    },

    dataChange2: function(url, operation, model) {
      emit('dataChange2', {
        url: url,
        operation: operation,
        model: model
      });
    },

    onDataChange2: function(callback) {
      on('dataChange2', callback);
    },

    chat: function(operation, troupeId, model) {
      emit('chat', {
        operation: operation,
        troupeId: troupeId,
        model: model
      });
    },

    onChat: function(callback) {
      on('chat', callback);
    },

    eyeballSignal: function(userId, troupeId, signal) {
      emit('eyeballSignal', {
        userId: userId,
        troupeId: troupeId,
        signal: signal
      });
    },

    onEyeballSignal: function(callback) {
      on('eyeballSignal', function(event) {
        return callback(event.userId, event.troupeId, event.signal);
      });
    },

    userRemovedFromTroupe: function(options) {
      emit('userRemovedFromTroupe', options);
    },

    onUserRemovedFromTroupe: function(callback) {
      on('userRemovedFromTroupe', callback);
    },

    batchUserBadgeCountUpdate: function(data) {
      emit('batchUserBadgeCountUpdate', data);
    },

    onBatchUserBadgeCountUpdate: function(callback) {
      on('batchUserBadgeCountUpdate', callback);
    },

    troupeDeleted: function(options) {
      emit('troupeDeleted', options);
    },

    onTroupeDeleted: function(callback) {
      on('troupeDeleted', callback);
    },

    chatMessage: function(data) {
      emit('chatMessage', data);
    },

    hookEvent: function(data) {
      emit('hookEvent', data);
    },

    userJoined: function(data) {
      emit('userJoined', data);
    },

    onUserJoined: function(callback) {
      on('userJoined', callback);
    },

    userLeft: function(data) {
      emit('userLeft', data);
    },

    repoPermissionsChangeDetected: function(uri, isPrivate) {
      emit('repo_perm_change', {
        uri: uri,
        isPrivate: isPrivate
      });
    },

    onRepoPermissionsChangeDetected: function(callback) {
      on('repo_perm_change', callback);
    },

    userTroupeLurkModeChange: function(data) {
      emit('user_troupe_lurk_mode_change', data);
    },

    onUserTroupeLurkModeChange: function(callback) {
      on('user_troupe_lurk_mode_change', callback);
    },

    newLurkActivity: function(data) {
      emit('new_lurk_activity', data);
    },

    onNewLurkActivity: function(callback) {
      on('new_lurk_activity', callback);
    }

  };
}

shutdown.addHandler('appevents', 2, function(callback) {
  pubClient.unsubscribe('*', callback);
});

module.exports = bind(onRemote);
module.exports.localOnly = bind(onLocalOnly);
