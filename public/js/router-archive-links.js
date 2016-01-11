"use strict";
var $ = require('jquery');
var context = require('utils/context');
var HeaderView = require('views/app/headerView');
var onready = require('./utils/onready');
var appEvents = require('utils/appevents');
var apiClient = require('components/apiClient');

require('components/timezone-cookie');
require('views/widgets/preload');
require('filtered-collection');
require('components/dozy');
require('template/helpers/all');
require('components/bug-reporting');
require('utils/tracking');
require('components/ping');

onready(function() {
  require('components/link-handler').installLinkHandler();
  appEvents.on('navigation', function(url) {
    window.location = url;
  });

  $('#noindex').on("change", function() {
    var noindex = $('#noindex')[0].checked;

    apiClient.room.put('', { noindex: !noindex })
      .then(function() {
        var msg = 'Room indexing disabled. The change will take effect the next time a search engine crawls this room.';
        $('#noindexStatus').html(!noindex ? msg : '');
      })
      .catch(function() {
        $('#noindexStatus').html('Oops, something went wrong. Reload and try again.');
      });
  });
  // When a user clicks an internal link, prevent it from opening in a new window
  $(document).on("click", "a.link", function(e) {
    var basePath = context.env('basePath');
    var href = e.target.getAttribute('href');
    if(!href || href.indexOf(basePath) !== 0) {
      return;
    }

    e.preventDefault();
    window.parent.location.href = href;
  });

  new HeaderView({ model: context.troupe(), el: '#header' });
});
