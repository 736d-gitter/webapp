#!/usr/bin/env node
'use strict';

var yargs = require('yargs');
var utils = require('./fixture-script-utils');

var opts = yargs
  .option('username', {
    required: true,
    description: 'username of the user that should perform the action',
    string: true
  })
  .option('group', {
    required: true,
    description: 'group uri of the group containing the forum'
  })
  .option('name', {
    required: true,
    description: 'category name'
  })
  .help('help')
  .alias('help', 'h')
  .argv;

utils.runScript(function() {
  return utils.getForumWithPolicyService(opts.username, opts.group)
    .then(function(forumWithPolicyService) {
      return forumWithPolicyService.createCategory({
        name: opts.name
      })
    })
    .then(function(category) {
      console.log("CREATED " + category.id);
    });
});
