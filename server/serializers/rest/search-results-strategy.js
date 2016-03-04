"use strict";

var _ = require("lodash");

function SearchResultsStrategy(options) {
  var resultItemStrategy = options.resultItemStrategy;

  this.preload = function(searchResults) {
    var items = _.flatten(searchResults.map(function(i) { return i.results; }), true);

    return resultItemStrategy.preload(items);
  };

  this.map = function(item) {
    return {
      hasMoreResults: item.hasMoreResults,
      limit: item.limit,
      skip: item.skip,
      results: item.results.map(function(i) { return resultItemStrategy.map(i); })
    };
  };

}

SearchResultsStrategy.prototype = {
  name: 'SearchResultsStrategy'
};


module.exports = SearchResultsStrategy;
