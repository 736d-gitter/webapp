define([
  'jquery',
  'log!notify'
], function($, log) {
  "use strict";

  $.prototype.notify = function(options) {
    var container = this;
    var content = options.content;
    var timeout = options.timeout ? options.timeout : 6000;
    var className = options.className ? options.className : '';
    var action = options.action ? options.action : 'show';
    var n, isNew = false;

    function show() {
      if (n.is(':hidden')) {
        // style
        n.show();
        n.css({ position: 'relative', left: -1 * n.outerWidth() });
        n.animate({ left: 250 });
      }
      // restart hide timeout
      n.data('notification-hide-timeout').restart();
    }

    function hide() {
      n.animate({ left: 0 }, function() {
        n.hide();
      });
    }

    function get() {
      // lookup or create the notification element
      if (options.id) {
        n = container.find('#'+options.id);
      }

      if (!options.id || n.length <= 0) {
        isNew = true;
        n = $('<div class="notification"'+((options.id) ? ' id="'+options.id+'"':'')+'></div>').hide();
        n.prependTo(container);
        // add the hide timeout for this notification
        n.data('notification-hide-timeout', new Timeout(function() {
          hide();
        }, timeout));
     }

    }

    get();

    // attach handlers on the notification-center container
    this.on('mouseenter', /* '.notification',*/ function(e) {

      if (container.data('notification-hide-running') === true && e.currentTarget === container[0]) {
        // log('cancelling timeouts', e);
        // cancel all hide timeouts
        container.data('notification-hide-running', false);
        container.find('.notification').each(function(n) {
          n.data('notification-hide-timeout').pause();
        });
      }
    });

    this.on('mouseleave', /* '.notification',*/ function(e) {
      if (container.data('notification-hide-running') === false && e.currentTarget === container[0]) {
        // log('resuming timeouts', e);
        // restart all the hide timeouts
        container.data('notification-hide-running', true);
        container.find('.notification').each(function(n) {
          n.data('notification-hide-timeout').resume(1000);
        });
      }
    });

    function set() {
      if (content) {
        // replace the content
        n.html(content);
      }

      // ensure the requested class is on the element
      n.addClass('notification-container');
      if (className) {
        n.addClass(className);
      }

      // add a click listener
      if (options.click) {
        n.on('click', options.click);
      }
    }

    set();

    function setDisplay() {
      if (action === 'show') {
        show(n);
      }
      else if (action === 'hide') {
        hide(n);
      }
    }

    setDisplay();

    return n;
  };

  // Timeout util
  function Timeout(callback, delay) {
    var timerId, start, remaining = delay;

    function timeout() {
      if (remaining !== Infinity) {
        return window.setTimeout(callback, remaining);
      }

      return null;
    }

    this.pause = function() {
      window.clearTimeout(timerId);
      remaining -= new Date() - start;
    };

    this.resume = function(add) {
      start = new Date();
      remaining += (add) ? add : 0;
      timerId = timeout();
    };

    this.restart = function() {
      start = new Date();
      remaining = delay;
      window.clearTimeout(timerId);
      timerId = timeout();
    };

    this.resume();
  }


});
