'use strict';

var _ = require('lodash');
var safeJson = require('./safe-json');
var util = require('util');
var clientEnv = require('gitter-client-env');
var cdn = require('gitter-web-cdn');
var pluralize = require('../shared/helpers/pluralize');
var when = require('../shared/helpers/when');

// eslint-disable-next-line node/no-unpublished-require, node/no-missing-require
const webpackBuildManifest = require('../../../output/assets/js/webpack-manifest.json');

function cdnHelper(url, parameters) {
  return cdn(url, parameters ? parameters.hash : null);
}

function cdnUrlGenerator(url, options = {}) {
  if (options.root) {
    return options.root + url;
  }

  return cdn(url, {});
}

function generateAssetsForChunk(chunkName) {
  const defaultAssets = webpackBuildManifest.entrypoints.default.assets || [];
  const entryAssets = webpackBuildManifest.entrypoints[chunkName].assets;
  const assets = Object.keys(
    defaultAssets
      .concat(entryAssets)
      .filter(asset => !/.*\.map$/.test(asset))
      .reduce((assetMap, asset) => {
        assetMap[asset] = true;
        return assetMap;
      }, {})
  );

  return assets;
}

const bootScript = _.memoize(function(chunkName, parameters) {
  const options = parameters.hash;
  const jsRoot = (options && options.jsRoot) || 'js';

  const assets = generateAssetsForChunk(chunkName);

  const baseUrl = cdnUrlGenerator(jsRoot + '/', options);
  const chunkScriptList = assets.map(asset => {
    const cdnUrl = cdnUrlGenerator(`${jsRoot}/${asset}`, options);
    return `<script type="text/javascript" src="${cdnUrl}"></script>`;
  });

  return `
    <script type="text/javascript">window.webpackPublicPath = '${baseUrl}';</script>
    ${chunkScriptList.join('\n')}
  `;
});

function createEnv(context, options) {
  if (options) {
    return _.extend(
      {
        lang: context.lang
      },
      clientEnv,
      options
    );
  }
  return clientEnv;
}
function generateEnv(parameters) {
  var options = parameters.hash;
  var env = createEnv(this, options);

  return (
    '<script type="text/javascript">' +
    'window.gitterClientEnv = ' +
    safeJson(JSON.stringify(env)) +
    ';' +
    '</script>'
  );
}

function generateTroupeContext(troupeContext, parameters) {
  var options = parameters.hash;

  var env = createEnv(this, options);

  return (
    '<script type="text/javascript">' +
    'window.gitterClientEnv = ' +
    safeJson(JSON.stringify(env)) +
    ';' +
    'window.troupeContext = ' +
    safeJson(JSON.stringify(troupeContext)) +
    ';' +
    '</script>'
  );
}

function toLowerCase(str) {
  return str.toLowerCase();
}

function pad(options) {
  var content = '' + options.fn(this);
  var width = options.hash.width || 40;
  var directionRight = options.hash.direction ? options.hash.direction === 'right' : true;

  while (content.length < width) {
    if (directionRight) {
      content += ' ';
    } else {
      content = ' ' + content;
    }
  }
  return content;
}

// FIXME REMOVE THIS ONCE THE NEW ERRORS PAGES ARE DONE
function typewriter(el, str) {
  return util.format(
    '<script type="text/javascript">\n' +
      'var text = "%s";' +
      'var input = $("%s");' +
      'input.select();' +
      'setTimeout(startTyping, 1000, input, text);' +
      'function startTyping(input, text) {' +
      'for ( var i = 0; i < text.length; i++ ) {' +
      'setTimeout(addText,120*i, input, text.charAt(i));' +
      '}' +
      '}' +
      'function addText(i,c) {' +
      'if (c !== "-") i.val( i.val() + c );' +
      '}' +
      '</script>',
    str,
    el
  );
}

function formatNumber(n) {
  if (n < 1000) return n;
  if (n < 1000000) return (n / 1000).toFixed(1) + 'k';
  return (n / 100000).toFixed(1) + 'm';
}

/** FIXME we do not yet cover the ONE-TO-ONE case, also need to do better default values
 * githubTypeToClass() takes a GitHub type and provdides a css class
 *
 */
function githubTypeToClass(type) {
  if (/_CHANNEL/.test(type)) return 'icon-hash';
  else if (/REPO/.test(type)) return 'octicon-repo';
  else if (/ORG/.test(type)) return 'octicon-organization';
  else return 'default';
}

function getRoomName(name) {
  return name.split('/')[1] || 'general';
}

module.exports = {
  cdn: cdnHelper,
  bootScript,
  generateEnv,
  generateTroupeContext,
  pluralize,
  when,
  toLowerCase,
  pad,
  typewriter,
  formatNumber,
  githubTypeToClass,
  getRoomName
};
