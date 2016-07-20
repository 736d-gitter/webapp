'use strict';

var faker = require('faker');
var _ = require('lodash');
var getRandomInt = require('./utils/get-random-int');
var getRandomBool = require('./utils/get-random-bool');
var getTopics = require('./topics');

var forum;

module.exports = function getFakeForumObject(){
  if(!forum) {
    var categories = _.range(getRandomInt(5, 7)).map(function(){
      return faker.hacker.adjective();
    });

    var tags = _.range(getRandomInt(10, 17)).map(function(){
      return faker.hacker.adjective();
    });

    var topics = getTopics();

    forum =  {
      name:        faker.commerce.productName(),
      topicsTotal: topics.length,
      topics:      topics,
      categories:  categories,
      tags:        tags,
    };
  }
  return forum;
};
