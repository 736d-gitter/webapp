'use strict';

var _ = require('lodash');
var Backbone = require('backbone');
var urlParser = require('../utils/url-parser');
const context = require('gitter-web-client-context');
const log = require('../utils/log');
const appEvents = require('../utils/appevents');

const useVueLeftMenu = context.hasFeature('vue-left-menu');

function SpaRoomSwitcher(troupesCollection, baseUrl, locationDelegate, windowLocationDelegate) {
  this._troupes = troupesCollection;
  this._baseUrl = baseUrl;
  this._locationDelegate = locationDelegate;
  this._windowLocationDelegate =
    windowLocationDelegate ||
    function() {
      return window.location;
    }; // Makes testing in node easier.
  this._isLoadingIFrame = false;
}

_.extend(SpaRoomSwitcher.prototype, Backbone.Events, {
  change: function(iframeUrl) {
    try {
      if (useVueLeftMenu) {
        this._changeNew(iframeUrl);
      } else {
        this._changeLegacy(iframeUrl);
      }
    } catch (err) {
      log.error('Problem in SpaRoomSwitcher change', { exception: err });
    }
  },

  _changeNew: function(iframeUrl) {
    const targetParsed = urlParser.parse(iframeUrl);

    let pathname = targetParsed.pathname;
    // Fix for IE 10 giving iframeUrls with first slash missing
    if (iframeUrl.search(/^https?:/i) < 0 && iframeUrl.charAt(0) !== '/') {
      pathname = '/' + pathname;
    }

    // Check that we are navigating to a ~chat page
    var targetInfo = this.getFrameType(pathname);
    if (targetInfo.type === 'chat' && targetInfo.roomUrl) {
      // Try find the room in the collection
      var newTroupe = this._troupes.findWhere({ url: targetInfo.roomUrl });
      if (newTroupe) {
        appEvents.trigger('dispatchVueAction', 'changeDisplayedRoom', newTroupe.id);
        return this.trigger('switch', newTroupe);
      }
    }

    // Else fallback to just redirecting
    window.location = targetInfo.roomUrl;
  },

  _changeLegacy: function(iframeUrl) {
    if (iframeUrl.search(/^https?:/i) < 0 && iframeUrl.charAt(0) !== '/') {
      // fix for IE 10 giving iframeUrls with first slash missing
      iframeUrl = '/' + iframeUrl;
    }

    var frameLocation = this._locationDelegate();
    var windowLocation = this._windowLocationDelegate();
    var targetParsed = urlParser.parse(iframeUrl);

    var self = this;
    function fallback() {
      // TODO: this should move across to the resolve service
      self._isLoadingIFrame = true;
      var windowHash = windowLocation.hash;
      var hash = !windowHash || windowHash === '#' ? '#initial' : windowHash;

      targetParsed.hash = hash;
      var href = urlParser.format(targetParsed);
      href = /^\/orgs\/([^\/]+)\/rooms\/?/.test(targetParsed.pathname)
        ? getOrgRoomUrl(targetParsed.pathname)
        : href;

      // If the only thing that differs is the hash, then force a reload
      if (href.replace(/#.*$/, '') === frameLocation.href.replace(/#.*$/, '')) {
        self.trigger('reload');
      } else {
        self.trigger('replace', href);
      }
    }

    //if we are ever in the process of loading a frame
    //throw the baby out with the bath water and refresh the whole frame
    //JP 4/11/15
    if (this._isLoadingIFrame) return fallback();

    // The frame is currently pointing at another site. Unlikely but possible
    var currentDomain = frameLocation.protocol + '//' + frameLocation.host;
    if (currentDomain !== this._baseUrl) return fallback();

    // Check that the frame already has a ~chat page
    var currentType = this.getFrameType(frameLocation.pathname).type;
    if (currentType !== 'chat') return fallback();

    // For now go back to the server for anything with a query
    if (targetParsed.search && targetParsed.search !== '?') return fallback();

    // Check that we are navigating to a ~chat page
    var targetInfo = this.getFrameType(targetParsed.pathname);
    if (targetInfo.type !== 'chat' || !targetInfo.roomUrl) return fallback();

    // Try find the room in the collection
    var newTroupe = this._troupes.findWhere({ url: targetInfo.roomUrl });

    // If we can't find the room, abort
    if (!newTroupe) return fallback();

    this.trigger('switch', newTroupe /*, TODO: permalink chat id */);
  },

  getFrameType: function(locationHref) {
    var match = locationHref.match(/(\/.*?)(\/~(\w+))?$/);
    if (!match) return {};

    return {
      roomUrl: match[1],
      type: match[3]
    };
  },

  setIFrameLoadingState: function(state) {
    this._isLoadingIFrame = state;
  }
});

function getOrgRoomUrl(pathname) {
  pathname = pathname.replace('~iframe', '');
  return pathname + (/\/$/.test(pathname) ? '~iframe' : '/~iframe');
}

module.exports = SpaRoomSwitcher;
