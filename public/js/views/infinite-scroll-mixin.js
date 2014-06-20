/*jshint strict:true, undef:true, unused:strict, browser:true *//* global define:false */
define([
  'utils/never-ending-story',
], function(NeverEndingStory) {
  "use strict";

  /**
   * This mixin is intended for Marionette.CollectionView
   */
  return {
    initialize: function() {
      var scrollElement = this.scrollElementSelector ? /*this.el*/document.querySelector(this.scrollElementSelector) : this.el;

      var scroll = new NeverEndingStory(scrollElement, { reverse: this.reverseScrolling });
      this.listenTo(scroll, 'approaching.top', function() {
        this.collection.fetchMoreBefore({});
      });

      this.listenTo(scroll, 'approaching.bottom', function() {
        this.collection.fetchMoreAfter({});
      });

      this.scroll = scroll;
    },

    beforeClose: function() {
      this.scroll.disable();
    }


  };

});
