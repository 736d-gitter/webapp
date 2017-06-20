"use strict";
var Mutant = require('mutantjs');
var RAF = require('utils/raf');
var _ = require('underscore');

module.exports = (function() {


  /** @const */ var TRACK_BOTTOM = 1;
  /** @const */ var STABLE = 3;

  /** Number of pixels we need to be within before we say we're at the bottom */
  /** @const */ var BOTTOM_MARGIN = 10;
  /** Number of pixels to show above a message that we scroll to. Context FTW!
  /** @const */ var TOP_OFFSET = 300;

  /* Put your scrolling panels on rollers */
  function Rollers(target, childContainer, options) {
    options = options || {};

    this._target = target;
    this._childContainer = childContainer || target;
    this._mutationHandlers = {};
    this._mutationHandlers[TRACK_BOTTOM] = this.updateTrackBottom.bind(this);
    this._mutationHandlers[STABLE] = this.updateStableTracking.bind(this);

    this._stableElement = null;

    if (options.doNotTrack) {
      this._mode = STABLE;
    } else {
      this.initTrackingMode();
    }

    var adjustScroll = this.adjustScroll.bind(this);

    this.mutant = new Mutant(target, adjustScroll, {
      transitions: true,
      observers: { attributes: false, characterData: false },
      ignoreTransitions: ['opacity'], // Opacity will never trigger a reflow...
      //ignoreFilter: function(mutationRecords) {
      //  var filter = mutationRecords.reduce(function(accum, r) {
      //    var v = r.type === 'attributes' && r.attributeName === 'class' && r.target.id === 'chat-container';
      //    accum = accum && v;
      //    return accum;
      //  }, true);
      //  return filter;
      //}
    });

    var _trackLocation = _.throttle(this.trackLocation.bind(this), 100);
    target.addEventListener('scroll', _trackLocation, false);
    window.addEventListener('resize', adjustScroll, false);
    window.addEventListener('focusin', adjustScroll, false);
    window.addEventListener('focusout', adjustScroll, false);
  }

  function continuous(cb, ms) {
    var until = Date.now() + ms;

    function next() {
      cb();

      if(Date.now() < until) {
        RAF(next);
      }
    }

    RAF(next);
  }

  Rollers.prototype = {
    adjustScroll: function() {
      this._mutationHandlers[this._mode]();
      this._postMutateTop = this._target.scrollTop;
      return true;
    },

    adjustScrollContinuously: function(ms) {
      continuous(this.adjustScroll.bind(this), ms);
    },

    initTrackingMode: function() {
      if(this.isScrolledToBottom()) {
        this._mode = TRACK_BOTTOM;
      } else {
        // Default to stable mode
        this.stable();
      }
    },

    stable: function(stableElement) {
      var target = this._target;
      this._mode = STABLE;

      this._stableElement = stableElement || this.getBottomMostVisibleElement();

      // nothing to stabilize (no content)
      if (!this._stableElement) return;

      // TODO: check that the element is within the targets DOM heirachy
      var scrollBottom = target.scrollTop + target.clientHeight;
      var stableElementTop = this._stableElement.offsetTop - target.offsetTop;

      // Calculate an record the distance of the stable element to the bottom of the view
      this._stableElementFromBottom = scrollBottom - stableElementTop;
    },

    setModeLocked: function(value) {
      this.modeLocked = value;
      if(!value) {
        this.trackLocation();
      }
    },

    disableTrackBottom: function() {
      this.disableTrackBottom = true;
    },

    enableTrackBottom: function() {
      this.disableTrackBottom = true;
      if(this.isScrolledToBottom()) {
        this.trackLocation();
      }
    },

    isScrolledToBottom: function() {
      var target = this._target;
      var atBottom = target.scrollTop >= target.scrollHeight - target.clientHeight - BOTTOM_MARGIN;
      return atBottom;
    },

    /*
     * Update the scroll position to follow the bottom of the scroll pane
     */
    updateTrackBottom: function() {
      var target = this._target;
      var scrollTop = target.scrollHeight - target.clientHeight;
      target.scrollTop = scrollTop;
    },

    startTransition: function(element, maxTimeMs) {
      this.mutant.startTransition(element, maxTimeMs);
    },

    endTransition: function(element) {
      this.mutant.endTransition(element);
    },

    /*
     * Scroll to the bottom and switch the mode to TRACK_BOTTOM
     */
    scrollToBottom: function() {
      var target = this._target;
      var scrollTop = target.scrollHeight - target.clientHeight;
      target.scrollTop = scrollTop;

      delete this._stableElement;
      delete this._stableElementFromBottom;
      this._mode = TRACK_BOTTOM;
      this._postMutateTop = scrollTop;
    },

    /*
     * Scroll to the bottom and switch the mode to TRACK_BOTTOM
     */
    scrollToElement: function(element, options) {
      var target = this._target;
      var scrollTop;

      if(options && options.centre) {
        // Centre the element in the viewport
        var elementHeight = element.offsetHeight;
        var viewportHeight = target.clientHeight;
        if(elementHeight < viewportHeight) {
          scrollTop = Math.floor(element.offsetTop + elementHeight/2 - viewportHeight/2);
        }
      }

      if(!scrollTop) {
        scrollTop = element.offsetTop - TOP_OFFSET;
      }

      if(scrollTop < 0) scrollTop = 0;

      //RAF(function () {
        target.scrollTop = scrollTop;
      //});

      this.stable(element);
    },

    /*
     * Scroll to the bottom and switch the mode to TRACK_BOTTOM
     */
    scrollToBottomContinuously: function(ms) {
      continuous(this.scrollToBottom.bind(this), ms);
    },

    updateStableTracking: function() {
      if(!this._stableElement) return;
      var target = this._target;

      var stableElementTop = this._stableElement.offsetTop - target.offsetTop;
      var top = stableElementTop - target.clientHeight + this._stableElementFromBottom;
      target.scrollTop = top;
    },

    trackLocation: function() {
      var target = this._target;
      if(this._postMutateTop === target.scrollTop) {
        return true;
      }

      var atBottom = target.scrollTop >= target.scrollHeight - target.clientHeight - BOTTOM_MARGIN;

      if(!this.modeLocked) {
        if(atBottom) {
          if(this._mode != TRACK_BOTTOM) {
            this._mode = TRACK_BOTTOM;
          }
        } else {
          if(this._mode != STABLE) {
            this._mode = STABLE;
          }
        }
      }

      if(this._mode === STABLE) {
        this._stableElement = this.getBottomMostVisibleElement();

        if (!this._stableElement) return;

        // TODO: check that the element is within the targets DOM heirachy
        var scrollBottom = target.scrollTop + target.clientHeight;
        var stableElementTop = this._stableElement.offsetTop - target.offsetTop;

        // Calculate an record the distance of the stable element to the bottom of the view
        this._stableElementFromBottom = scrollBottom - stableElementTop;
      }

      return true;
    },

    getScrollBottom: function() {
      var scrollTop = this._target.scrollTop;
      return this._target.clientHeight + scrollTop;
    },

    getBottomMostVisibleElement: function() {
      var scrollTop = this._target.scrollTop;
      var clientHeight = this._target.clientHeight;
      var max = scrollTop + clientHeight;
      var children = this._childContainer.children;

      for(var i = children.length - 1; i >= 0; i--) {
        var child = children[i];
        if(child.offsetTop < max) {
          return child;
        }
      }

      return;
    },

    getMostCenteredElement: function() {
      var scrollTop = this._target.scrollTop;
      var clientHeight = this._target.clientHeight;
      var max = scrollTop + clientHeight;
      var children = this._childContainer.children;

      for(var i = children.length - 1; i >= 0; i--) {
        var child = children[i];
        var middle = clientHeight / 2;
        var pos = max - child.offsetTop;
        if (pos > middle) {
          return child;
        }
      }

      return;
    }
  };

  return Rollers;

})();
