'use strict';

var gulp = require('gulp');
var gutil = require('gulp-util');
var sourcemaps = require('gulp-sourcemaps');
var webpack = require('gulp-webpack');
var uglify = require('gulp-uglify');
var restoreTimestamps = require('./gulp-restore-timestamps');
var getSourceMapOptions = require('./get-sourcemap-options');

/**
 * Hook into the compile stage
 */
gulp.task('clientapp:compile', ['clientapp:compile:copy-files', 'clientapp:compile:webpack']);

/**
 * Hook into the post-compile stage
 */
gulp.task('clientapp:post-compile', ['clientapp:post-compile:uglify']);

gulp.task('clientapp:compile:copy-files', function() {
  return gulp.src([
      'public/fonts/**',
      'public/images/**',
      'public/sprites/**',
      'public/repo/**'
    ], { base: "./public", stat: true })
    .pipe(gulp.dest('output/assets'))
    .pipe(restoreTimestamps());
});

gulp.task('clientapp:compile:webpack', ['clientapp:compile:copy-files'], function() {
  return gulp.src('./public/js/webpack.config')
    .pipe(webpack(require('../public/js/webpack.config'), null, function(err, stats) {
      if (!stats) return;
      /*
      Removed as webpack-bundle-size-analyzer is broken
      var webpackBundleSizeAnalyzer = require('webpack-bundle-size-analyzer');

      var bundleStats = stats.toJson("normal");
      var depTrees = webpackBundleSizeAnalyzer.dependencySizeTree(bundleStats);

      gutil.log('-----------------------------------------------');
      gutil.log('Webpack Bundle Size Report');
      gutil.log('-----------------------------------------------');
      depTrees.forEach(function (tree) {
        return webpackBundleSizeAnalyzer.printDependencySizeTree(tree);
      });
      gutil.log('-----------------------------------------------');
      */
    }))
    .pipe(gulp.dest('output/assets/js'));
});

function getUglifyOptions() {
  if (process.env.FAST_UGLIFY && JSON.parse(process.env.FAST_UGLIFY)) {
    gutil.log('Using fast uglify. The resulting javascript artifacts will be much bigger');
    return {
      mangle: false,
      compress: false
    };
  }
}

gulp.task('clientapp:post-compile:uglify', function() {
  var sourceMapOpts = getSourceMapOptions();
  return gulp.src('output/assets/js/*.js')
    .pipe(sourcemaps.init({ /* loadMaps: true */ }))
    .pipe(uglify(getUglifyOptions()))
    .pipe(sourcemaps.write(sourceMapOpts.dest, sourceMapOpts.options))
    .pipe(gulp.dest('output/assets/js'));
});
