/*jshint globalstrict: true, trailing: false, unused: true, node: true */
"use strict";

var moment               = require('moment');
var appMiddleware        = require('./middleware');
var chatService          = require('../../services/chat-service');
var heatmapService       = require('../../services/chat-heatmap-service');
var restSerializer       = require('../../serializers/rest-serializer');
var contextGenerator     = require('../../web/context-generator');
var Q                    = require('q');
var roomService          = require('../../services/room-service');
var env                  = require('gitter-web-env');
var burstCalculator      = require('../../utils/burst-calculator');
var roomPermissionsModel = require('../../services/room-permissions-model');
var timezoneMiddleware   = require('../../web/middlewares/timezone');
var identifyRoute        = require('gitter-web-env').middlewares.identifyRoute;
var resolveRoomAvatarUrl = require('gitter-web-shared/avatars/resolve-room-avatar-url');
var dateTZtoUTC          = require('gitter-web-shared/time/date-timezone-to-utc');
var debug                = require('debug')('gitter:app-archive');

var _ = require('underscore');
function generateChatTree(chatActivity) {
  // group things in nested maps
  var yearMap = {};
  _.each(chatActivity, function(count, unixTime) {
    var date = moment(unixTime, "X");
    var year = date.year();
    var month = date.format("MM"); // 01-12
    var day = date.format("DD"); // 01-31
    if (!yearMap[year]) {
      yearMap[year] = {};
    }
    if (!yearMap[year][month]) {
      yearMap[year][month] = {};
    }
    yearMap[year][month][day] = count;
  });
  //console.log(JSON.stringify(yearMap, null, 2));

  // change the nested maps into sorted nested arrays of objects
  var yearArray = [];
  _.each(yearMap, function(monthMap, year) {
    var monthArray = [];
    _.each(monthMap, function(dayMap, month) {
      var dayArray = [];
      _.each(dayMap, function(count, day) {
        dayArray.push({day: day, count: count});
      });
      dayArray = _.sortBy(dayArray, 'day') // not reversed
      var monthName = moment.months()[parseInt(month, 10)-1];
      monthArray.push({month: month, monthName: monthName, days: dayArray}); // monthName?
    });
    monthArray = _.sortBy(monthArray, 'month').reverse();
    yearArray.push({year: year, months: monthArray});
  });
  yearArray = _.sortBy(yearArray, 'year').reverse();
  //console.log(JSON.stringify(yearArray, null, 2));

  return yearArray;
}

exports.datesList = [
  identifyRoute('app-archive-main'),
  appMiddleware.uriContextResolverMiddleware({ create: false }),
  function(req, res, next) {
    var user = req.user;
    var troupe = req.uriContext.troupe;

    // This is where we want non-logged-in users to return
    if(!user && req.session) {
      req.session.returnTo = '/' + troupe.uri;
    }

    var roomUrl = '/api/v1/rooms/' + troupe.id;
    var avatarUrl = resolveRoomAvatarUrl(troupe.uri);
    var isPrivate = troupe.security !== "PUBLIC";

    var templateContext = {
      //isAdmin: access,
      //troupeContext: troupeContext,
      //chatTree: chatTree,
      layout: 'archive',
      user: user,
      archives: true,
      bootScriptName: 'router-archive-home',
      cssFileName: 'styles/router-archive-home.css',
      troupeTopic: troupe.topic,
      githubLink: '/' + req.uriContext.uri,
      troupeName: req.uriContext.uri,
      isHomePage: true,
      noindex: troupe.noindex,
      roomUrl: roomUrl,
      accessToken: req.accessToken,
      public: troupe.security === 'PUBLIC',
      avatarUrl: avatarUrl,
      isPrivate: isPrivate
    };

    return roomService.validateRoomForReadOnlyAccess(user, troupe)
      .then(function() {
        return roomPermissionsModel(user, 'admin', troupe)
      })
      .then(function(access) {
        templateContext.isAdmin = access
        // no start, no end, no timezone for now
        return heatmapService.getHeatmapForRoom(troupe.id)
      })
      .then(function(chatActivity) {
        templateContext.chatTree = generateChatTree(chatActivity);
        return contextGenerator.generateTroupeContext(req)
      })
      .then(function(troupeContext) {
        templateContext.troupeContext = troupeContext;
        res.render('archive-home-template', templateContext);
      })
      .catch(next);
  }
];


exports.chatArchive = [
  identifyRoute('app-archive-date'),
  appMiddleware.uriContextResolverMiddleware({ create: false }),
  timezoneMiddleware,
  function(req, res, next) {
    var user = req.user;
    var troupe = req.uriContext.troupe;

    return roomService.validateRoomForReadOnlyAccess(user, troupe)
      .then(function() {
        var troupeId = troupe.id;

        // This is where we want non-logged-in users to return
        if(!user && req.session) {
          req.session.returnTo = '/' + troupe.uri;
        }

        var yyyy = parseInt(req.params.yyyy, 10);
        var mm = parseInt(req.params.mm, 10);
        var dd = parseInt(req.params.dd, 10);

        var startDateUTC = moment({ year: yyyy, month: mm - 1, day: dd });

        var nextDateUTC = moment(startDateUTC).add(1, 'days');
        var previousDateUTC = moment(startDateUTC).subtract(1, 'days');

        var startDateLocal = dateTZtoUTC(yyyy, mm, dd, res.locals.tzOffset);
        var endDateLocal = moment(startDateLocal).add(1, 'days').toDate();

        var today = moment().endOf('day');
        if(moment(nextDateUTC).endOf('day').isAfter(today)) {
          nextDateUTC = null;
        }

        if(moment(previousDateUTC).startOf('day').isBefore(moment([2013, 11, 1]))) {
          previousDateUTC = null;
        }

        debug('Archive searching for messages in troupe %s in date range %s-%s', troupeId, startDateLocal, endDateLocal);
        return chatService.findChatMessagesForTroupeForDateRange(troupeId, startDateLocal, endDateLocal)
          .then(function(chatMessages) {

            var strategy = new restSerializer.ChatStrategy({
              unread: false, // All chats are read in the archive
              troupeId: troupeId
            });

            return Q.all([
                contextGenerator.generateTroupeContext(req),
                restSerializer.serialize(chatMessages, strategy)
              ]);
          })
          .spread(function(troupeContext, serialized) {
            troupeContext.archive = {
              archiveDate: startDateUTC,
              nextDate: nextDateUTC,
              previousDate: previousDateUTC
            };

            var language = req.headers['accept-language'];
            if(language) {
              language = language.split(';')[0].split(',');
            } else {
              language = 'en-uk';
            }

            var p = previousDateUTC && moment(previousDateUTC);
            var n = nextDateUTC && moment(nextDateUTC);
            var uri = req.uriContext.uri;

            var startDateLocale = moment(startDateUTC).locale(language);

            var ordinalDate = startDateLocale.format('Do');
            var numericDate = startDateLocale.format('D');

            var ordinalPart;
            if(ordinalDate.indexOf('' + numericDate) === 0) {
              ordinalPart = ordinalDate.substring(('' + numericDate).length);
            } else {
              ordinalPart = '';
            }

            var previousDateFormatted = p && p.locale(language).format('Do MMM YYYY');
            var dayNameFormatted = numericDate;
            var dayOrdinalFormatted = ordinalPart;
            var previousDateLink = p && '/' + uri + '/archives/' + p.format('YYYY/MM/DD');
            var nextDateFormatted = n && moment(n.valueOf()).locale(language).format('Do MMM YYYY');
            var nextDateLink = n && '/' + uri + '/archives/' + n.format('YYYY/MM/DD');
            var monthYearFormatted = startDateLocale.format('MMM YYYY');

            var billingUrl = env.config.get('web:billingBaseUrl') + '/bill/' + req.uriContext.uri.split('/')[0];
            var roomUrl = '/api/v1/rooms/' + troupe.id;

            var avatarUrl = resolveRoomAvatarUrl(troupe.uri);
            var isPrivate = troupe.security !== "PUBLIC";

            return res.render('chat-archive-template', {
              layout: 'archive',
              archives: true,
              archiveChats: true,
              isRepo: troupe.githubType === 'REPO',
              bootScriptName: 'router-archive-chat',
              cssFileName: 'styles/router-archive-chat.css',
              githubLink: '/' + req.uriContext.uri,
              user: user,
              troupeContext: troupeContext,
              troupeName: req.uriContext.uri,
              troupeTopic: troupe.topic,
              chats: burstCalculator(serialized),
              billingUrl: billingUrl,
              noindex: troupe.noindex,
              roomUrl: roomUrl,
              accessToken: req.accessToken,
              avatarUrl: avatarUrl,
              isPrivate: isPrivate,

              /* For prerendered archive-navigation-view */
              previousDate: previousDateFormatted,
              dayName: dayNameFormatted,
              dayOrdinal: dayOrdinalFormatted,
              previousDateLink: previousDateLink,
              nextDate: nextDateFormatted,
              nextDateLink: nextDateLink,
              monthYearFormatted: monthYearFormatted,

              showDatesWithoutTimezone: true // Timeago widget will render whether or not we know the users timezone
            });

          });
      })
      .catch(next);
  }
];
