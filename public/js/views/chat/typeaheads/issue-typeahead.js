"use strict";

var isMobile = require('utils/is-mobile');
var apiClient = require('components/apiClient');
var template = require('./tmpl/typeahead.hbs');

module.exports = function() {
  return {
    match: /(^|\s)(([\w-_]+\/[\w-_]+)?#(\d*))$/,
    maxCount: isMobile() ? 3 : 10,
    search: function (term, callback) {
      var terms = term.split('#');
      var repoName = terms[0];
      var issueNumber = terms[1];
      var query = {};

      if(repoName) query.repoName = repoName;
      if(issueNumber) query.issueNumber = issueNumber;

      apiClient.room.get('/issues', query)
        .then(function(resp) {
          callback(resp);
        })
        .fail(function() {
          callback([]);
        });
    },
    template: function(issue) {
      return template({
        name: issue.number,
        description: issue.title
      });
    },
    replace: function(issue) {
      return '$1$3#' + issue.number + ' ';
    }
  };
};
