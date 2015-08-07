var gulp = require('gulp');
var gutil = require('gulp-util');
var bower = require('bower');
var concat = require('gulp-concat');
var sass = require('gulp-sass');
var minifyCss = require('gulp-minify-css');
var rename = require('gulp-rename');
var sh = require('shelljs');

var paths = {
  sass: ['./scss/**/*.scss']
};

gulp.task('default', ['sass']);

gulp.task('sass', function(done) {
  gulp.src('./scss/ionic.app.scss')
    .pipe(sass())
    .pipe(gulp.dest('./www/css/'))
    .pipe(minifyCss({
      keepSpecialComments: 0
    }))
    .pipe(rename({ extname: '.min.css' }))
    .pipe(gulp.dest('./www/css/'))
    .on('end', done);
});

gulp.task('watch', function() {
  gulp.watch(paths.sass, ['sass']);
});

gulp.task('install', ['git-check'], function() {
  return bower.commands.install()
    .on('log', function(data) {
      gutil.log('bower', gutil.colors.cyan(data.id), data.message);
    });
});

gulp.task('git-check', function(done) {
  if (!sh.which('git')) {
    console.log(
      '  ' + gutil.colors.red('Git is not installed.'),
      '\n  Git, the version control system, is required to download Ionic.',
      '\n  Download git here:', gutil.colors.cyan('http://git-scm.com/downloads') + '.',
      '\n  Once git is installed, run \'' + gutil.colors.cyan('gulp install') + '\' again.'
    );
    process.exit(1);
  }
  done();
});





var cordovaPlugins = [
  'com.ionic.deploy',
  'com.ionic.keyboard',
  'cordova-plugin-console',
  'cordova-plugin-crosswalk-webview',
  'cordova-plugin-device',
  'cordova-plugin-dialogs',
  'cordova-plugin-file',
  'cordova-plugin-file-transfer',
  'cordova-plugin-geolocation',
  'cordova-plugin-media',
  'cordova-plugin-media-capture',
  'cordova-plugin-network-information',
  'cordova-plugin-splashscreen',
  'cordova-plugin-whitelist',
  'io.github.pwlin.cordova.plugins.fileopener2',
  'org.apache.cordova.camera',
];
// can define this in some config file
/*
 var config = require('ionic.config');
 var .cordovaPlugins = config.cordovaPlugins
 */

gulp.task('addPlg', function() {

  exec('ionic plugin add '+'../pulgin/cacheMap/');
  var d = Q.defer();
  // execute ionic plugin add for each of the plugins
  var addPromises = cordovaPlugins.map(function(plugin) {
    return exec('ionic plugin add '+plugin+'com.rde.cachemap');
  });
  // wait for all shell actions to complete
  Q.all(addPromises).then(function() {
    d.resolve();
  });
  return d.promise;
});

gulp.task('rmPlg', function() {
  exec('ionic plugin add '+'com.rde.cachemap"');

  var d = Q.defer();
  // fetch list of all installed plugins
  var installedPlugins = require('./plugins/android.json').installed_plugins;
  // execute ionic plugin rm for each installed plugin
  var rmPromises = [];
  for(var plugin in installedPlugins) {
    rmPromises.push(exec('ionic plugin rm '+plugin));
  };
  // wait for all shell actions to complete
  Q.all(rmPromises).then(function() {
    d.resolve();
  });
  return d.promise;
});