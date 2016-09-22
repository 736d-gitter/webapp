"use strict";

var reactDomServer = require('react-dom/server');
var components = require('./components');

module.exports = function(componentName, context) {
  var Component = components(componentName);
  console.log('context', context);

  //Return the rendered component with a given context
  return reactDomServer.renderToString(Component(context));
};
