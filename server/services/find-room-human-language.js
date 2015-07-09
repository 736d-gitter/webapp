'use strict';

var esClient = require('../utils/elasticsearch-client');

function findRoomHumanLanguage(roomId) {
  var query = {
    timeout: 500,
    index: 'gitter-primary',
    type: 'chat',
    search_type: "count",
    "body": {
      "query": {
        "filtered": {
          "query": {
            "match_all": {}
          },
          "filter": {
            "term": {
              "toTroupeId": roomId
            }
          }
        }
      },
      "aggs": {
        "lang": {
          "terms": {
            "size": 5,
            "field": "lang"
          }
        }
      }
    }
  };

  return esClient.search(query)
    .then(function(results) {
      console.log(results.aggregations.lang);
      if (!results.aggregations.lang.buckets.length) return;
      var highestBucket = results.aggregations.lang.buckets[0];

      if (highestBucket.doc_count < 40) {
        console.log('ONLY GOT ', highestBucket.doc_count, 'ITEMS')
        return; // Not enough data
      }

      return highestBucket.key;
    });
}

module.exports = findRoomHumanLanguage;
