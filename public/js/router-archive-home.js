"use strict";
var $ = require('jquery');
var context = require('utils/context');
var HeaderView = require('views/app/headerView');
var apiClient = require('components/apiClient');
var CalHeatMap = require('cal-heatmap');
var onready = require('./utils/onready');
var appEvents = require('utils/appevents');
var getTimezoneInfo = require('utils/detect-timezone');

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
      .fail(function() {
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

  var troupeId = context.getTroupeId();
  var today = new Date();
  var elevenFullMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  var gitterLaunchDate = new Date(2013, 10, 1); // 1 November 2013

  var tz = getTimezoneInfo().iso;

  function mangleHeatmap() {
    var $rects = $('.graph-rect').not('.q1,.q2,.q3,.q4,.q5');
    $rects.each(function(i, el) {
      el.classList.remove('hover_cursor');
      el.classList.add('empty');
    });
  }

  var cal = new CalHeatMap();
  cal.init({
    start: elevenFullMonthsAgo, // eleven months + this partial month = 12 blocks shown
    maxDate: today,
    minDate: gitterLaunchDate,
    range: 12,
    domain: "month",
    subDomain: "day",
    considerMissingDataAsZero: false,
    displayLegend: false,
    data: {},
    previousSelector: '.previous-domain',
    nextSelector: '.next-domain',
    onMinDomainReached: function(reached) {
      if (reached) {
        $('.previous-domain').addClass('disabled');
      } else {
        $('.previous-domain').removeClass('disabled');
      }
    },
    onMaxDomainReached: function(reached) {
      if (reached) {
        $('.next-domain').addClass('disabled');
      } else {
        $('.next-domain').removeClass('disabled');
      }
    },
    onClick: function(date, value) {
      if(!value) return;

      var yyyy = date.getFullYear();
      var mm = date.getMonth() + 1;
      if(mm < 10) mm = "0" + mm;

      var dd = date.getDate();
      if(dd < 10) dd = "0" + dd;

      window.location.assign('/' + context.troupe().get('uri') + '/archives/' + yyyy + '/' + mm + '/' + dd);
    },
    onComplete: function() {
      mangleHeatmap();
    }
  });
  apiClient.priv.get('/chat-heatmap/' + troupeId, { tz: tz })
    .then(function(heatmapData) {
      cal.update(heatmapData);
      mangleHeatmap();
      setTimeout(mangleHeatmap, 0);
    });

  // new Router();

  // Backbone.history.start();


});
