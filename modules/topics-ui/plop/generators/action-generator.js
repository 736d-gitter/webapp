"use strict";

var path = require('path');
var glob = require('glob');//eslint-disable-line node/no-unpublished-require

module.exports = function(plop){

  var baseConstFilePath = path.resolve(__dirname, '../../shared/constants');
  var constFiles = glob.sync(baseConstFilePath + '/**/*.js').map(function(fullPath){
    return path.relative(baseConstFilePath, fullPath);
  });

  var baseActionCreatorsFolder = path.resolve(__dirname, '../../shared/action-creators');
  var actionCreatorFolders = glob.sync(baseActionCreatorsFolder + '/*/').map(function(folderPath){
    return path.relative(baseActionCreatorsFolder, folderPath);
  });

  plop.setGenerator('action', {
    description: 'Generate a system action',
    prompts: [{
      type: 'input',
      name: 'name',
      message: 'What is the name of your action?',
      validate: function (value) {
        if ((/.+/).test(value)) { return true; }
        return 'name is required';
      }
    },
    {
      type: 'list',
      name: 'actionBaseDir',
      message: 'Pick a sub folder to add the action creator to',
      choices: actionCreatorFolders,
    },
    {
      type: 'list',
      name: 'constantFile',
      message: 'Pick a file to add you event constant to',
      choices: constFiles,
    }],
    actions: function(data){

      return [{
        //Add the action type to a constant file
        type: 'modify',
        path: path.resolve(__dirname, '../../shared/constants/', data.constantFile),
        pattern: /\Z/, //TODO THIS DOESNT WORK :(
        template: "export const {{constantCase name}} = '{{dashCase name}}'"
      },
      {
        type: 'add',
        // The plop templates don't work with backslashes :(
        path: path.join(path.resolve(__dirname, '../../shared/action-creators', data.actionBaseDir), './{{dashCase name}}.js').replace(/\\/g, '/'),
        templateFile: path.resolve(__dirname, '../templates/action-creator.txt')
      },
      {
        type: 'add',
        // The plop templates don't work with backslashes :(
        path: path.join(path.resolve(__dirname, '../../test/specs/shared/action-creators', data.actionBaseDir), './{{dashCase name}}-test.js').replace(/\\/g, '/'),
        templateFile: path.resolve(__dirname, '../templates/action-creator-test.txt')
      }];

    }
  });

};
