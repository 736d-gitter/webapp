'use strict';

var cdn = require('gitter-web-cdn');

function cdnSubResources(resources, jsRoot) {
  var resourceList = ['runtime', 'default.chunk', 'vendor.chunk'];
  if (resources) {
    resourceList = resourceList.concat(resources.map(resource => `${resource}.chunk`));
  }

  return resourceList
    .map(function(f) {
      return cdn(jsRoot + '/' + f + '.js');
    })
    .concat(cdn('fonts/sourcesans/SourceSansPro-Regular.otf.woff'));
}

var SUBRESOURCE_MAPPINGS = {
  'router-app': ['router-app', 'router-chat'],
  'mobile-nli-chat': ['mobile-nli-chat', 'router-nli-chat'],
  'mobile-userhome': ['mobile-userhome'],
  userhome: ['userhome'],
  'router-chat': ['router-chat'],
  'router-nli-chat': ['router-nli-chat'],
  'mobile-chat': ['mobile-chat'],
  'router-mobile-app': ['mobile-app']
};

var CACHED_SUBRESOURCES = Object.keys(SUBRESOURCE_MAPPINGS).reduce(function(memo, key) {
  memo[key] = cdnSubResources(SUBRESOURCE_MAPPINGS[key], 'js');
  return memo;
}, {});

function getSubResources(entryPoint, jsRoot) {
  if (!jsRoot) {
    return CACHED_SUBRESOURCES[entryPoint];
  }

  return cdnSubResources(SUBRESOURCE_MAPPINGS[entryPoint], jsRoot);
}

module.exports = getSubResources;
