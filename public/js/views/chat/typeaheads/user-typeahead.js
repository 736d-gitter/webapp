"use strict";

var isMobile = require('utils/is-mobile');
var context = require('utils/context');
var apiClient = require('components/apiClient');
var chatCollection = require('collections/instances/integrated-items').chats;
var template = require('./tmpl/typeahead.hbs');
var _ = require('underscore');

var MAX_TYPEAHEAD_SUGGESTIONS = isMobile() ? 3 : 10;

var lcUsername = (context.user() && context.user().get('username') || '').toLowerCase();

function getRecentMessageSenders() {
  var users = chatCollection.map(function(message) {
    return message.get('fromUser');
  }).filter(function(user) {
    return !!user;
  }).reverse();
  return unique(users);
}

function filterWithTerm(term) {
  var lowerTerm = term.toLowerCase();
  return function(user) {
    return user && (
             user.username.toLowerCase().indexOf(lowerTerm) === 0 ||
             ( user.displayName && user.displayName.toLowerCase().indexOf(lowerTerm) === 0 )
           );
  };
}

function isNotCurrentUser(user) {
  return user.username.toLowerCase() !== lcUsername;
}

function unique(users) {
  return _.unique(users, function(user) {
    return user.id;
  });
}

var lastTerm;
var lastCallback;
var debounceCallback;

// jquery.textcomplete requires *all* async
// functions to call their callback.
//
// So debouncing has to be custom.
function userSearchDebounced(term, callback) {
  if (lastCallback) {
    // kill the old callback
    lastCallback([]);
  }

  // long live the new callback!
  lastTerm = term;
  lastCallback = callback;

  if (!debounceCallback) {
    debounceCallback = setTimeout(function() {
      // allow new search to be debounced
      debounceCallback = null;

      // callback and term now belong to userSearch()
      var requestTerm = lastTerm;
      var requestCallback = lastCallback;
      lastTerm = null;
      lastCallback = null;

      userSearch(requestTerm, requestCallback);
    }, 500);    
  }
}

function userSearch(term, callback) {
  apiClient.room.get('/users', { q: term, limit: MAX_TYPEAHEAD_SUGGESTIONS })
    .then(function(users) {
      callback(users);
    })
    .fail(function() {
      callback([]);
    });
}

var lcPrevTerm = '';
var prevResults = [];

module.exports = {
  match: /(^|\s)@(\/?[a-zA-Z0-9_\-]*)$/,
  maxCount: MAX_TYPEAHEAD_SUGGESTIONS,
  search: function(term, callback) {
    var lcTerm = term.toLowerCase();

    var users = [];

    if (lcTerm.indexOf(lcPrevTerm) === 0) {
      users = prevResults;
    }

    users = users.concat(getRecentMessageSenders());

    users = unique(users)
      .filter(isNotCurrentUser)
      .filter(filterWithTerm(term));

    lcPrevTerm = lcTerm;
    prevResults = users;

    if (users.length) {
      // give instant feedback
      // (jquery.textcomplete supports multiple callbacks)
      callback(users, true);
    }

    if ('/all'.indexOf(lcTerm) === 0 && context().permissions.admin) {
      users = users.slice(0, MAX_TYPEAHEAD_SUGGESTIONS - 1);
      users.push({ username: '/all', displayName: 'Group' });

      // there will be no server results for '/all', so return now.
      return callback(users);
    }

    if (term.length === 0) {
      // server results wont improve anything, so return now.
      return callback(users);
    }

    // lets get some server results!
    return userSearchDebounced(term, function(serverUsers) {
      serverUsers = serverUsers.filter(isNotCurrentUser);
      users = unique(users.concat(serverUsers));

      if (lcTerm === lcPrevTerm) {
        prevResults = users;
      }

      callback(users);
    });
  },
  template: function(user) {
    return template({
      name: user.username,
      description: user.displayName
    });
  },
  replace: function(user) {
    return '$1@' + user.username + ' ';
  }
};
