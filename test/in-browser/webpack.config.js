'use strict';

var path = require('path');
var ProgressBarPlugin = require('progress-bar-webpack-plugin');

var opts = require('yargs')
  .option('nocoverage', {
    type: 'boolean',
    description: 'Age in minutes of the unread items'
  })
  .help('help')
  .alias('help', 'h')
  .argv;


var preLoaders = [];
if(!opts['nocoverage']) {
  preLoaders.push({
    test: /\.js$/,
    exclude: /(test|node_modules|repo)/,
    loader: 'istanbul-instrumenter',
  });
}

module.exports = {
  entry: path.resolve(__dirname, './fixtures/entry.js'),
  output: {
    path: path.join(__dirname, './fixtures/build'),
    filename: 'test.js',
    publicPath: '/fixtures/build/',
  },

  devtool: 'inline-source-map',
  module: {
    preLoaders: preLoaders,
    loaders: [
      {
        test: /\.hbs$/,
        loader: 'gitter-handlebars-loader', // disable minify for now + path.resolve(path.join(__dirname, "../../build-scripts/html-min-loader"))
        query: {
          helperDirs: [
            path.resolve(__dirname, '../../shared/handlebars/helpers')
          ],
          knownHelpers: [
            'cdn',
            'avatarSrcSet'
          ],
          partialsRootRelative: path.resolve(__dirname, '../../public/templates/partials') + path.sep
        }
      },
      {
        test:    /.css$/,
        loader:  'style-loader!css-loader!postcss-loader',
      }
    ],
  },
  plugins: [
     new ProgressBarPlugin(),
  ],
  resolve: {
    modulesDirectories: [
      'node_modules',
      path.resolve(__dirname, '../../public/js'),
    ],
    alias: {
      jquery: require.resolve('jquery'),
      'bootstrap_tooltip': path.resolve(__dirname, '../../public/js/utils/tooltip.js'),
      'public': path.resolve(__dirname, '../../public'),
      'fixtures': path.resolve(__dirname, './fixtures'),
      'views/menu/room/search-results/search-results-view': path.resolve(__dirname, './fixtures/helpers/search-results-view.js'),
      'views/menu/room/search-input/search-input-view': path.resolve(__dirname, './fixtures/helpers/search-input-view.js'),
      'components/apiClient': path.resolve(__dirname, './fixtures/helpers/apiclient.js'),
      'utils/appevents': path.resolve(__dirname, './fixtures/helpers/appevents.js'),
      'filtered-collection': path.resolve(__dirname, '../../public/repo/filtered-collection/filtered-collection.js'),
      'gitter-client-env': path.resolve(__dirname, './fixtures/helpers/gitter-client-env.js'),
    },
  },
  node: {
    fs: 'empty',
  },
};
