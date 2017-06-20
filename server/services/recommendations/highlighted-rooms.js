'use strict';

var _ = require('underscore');
var Q = require('q');

var HIGHLIGHTED_ROOMS = [
  {
    uri: 'gitterHQ/gitter',
    githubType: 'REPO',
    localeLanguage: 'en',
    roomExists: true,
    highlighted: true
  }, {
    uri: 'marionettejs/backbone.marionette',
    language: 'JavaScript',
    githubType: 'REPO',
    localeLanguage: 'en',
    roomExists: true,
    highlighted: true
  },{
    uri: 'LaravelRUS/chat',
    language: 'PHP',
    githubType: 'REPO',
    localeLanguage: 'ru',
    roomExists: true,
    highlighted: true
  }, {
    uri: 'gitterHQ/nodejs',
    language: 'JavaScript',
    githubType: 'ORG_CHANNEL',
    localeLanguage: 'en',
    roomExists: true,
    highlighted: true
  },{
    uri: 'rom-rb/chat',
    language: 'Ruby',
    githubType: 'ORG_CHANNEL',
    localeLanguage: 'en',
    roomExists: true,
    highlighted: true
  }, {
    uri: 'webpack/webpack',
    language: 'JavaScript',
    githubType: 'REPO',
    localeLanguage: 'en',
    roomExists: true,
    highlighted: true
  }, {
    uri: 'ruby-vietnam/chat',
    language: 'Ruby',
    githubType: 'ORG_CHANNEL',
    localeLanguage: 'vi',
    roomExists: true,
    highlighted: true
  }, {
    uri: 'angular-ui/ng-grid',
    language: 'JavaScript',
    githubType: 'REPO',
    localeLanguage: 'en',
    roomExists: true,
    highlighted: true
  }
];

module.exports = function (userId, currentRoomUri) {
  return Q.all(HIGHLIGHTED_ROOMS.map(function(recommendation) {
    // if (recommendation.githubType === 'REPO') {
    //   return highlightedRoomCache(null, recommendation.uri)
    //     .then(function(repo) {
    //       return _.extend({ }, recommendation, { githubRepo: repo });
    //     });
    // }

    return _.extend({ roomExists: true, highlighted: true }, recommendation);
  }));
};
