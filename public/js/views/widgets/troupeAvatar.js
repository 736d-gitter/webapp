/*jshint strict:true, undef:true, unused:strict, browser:true *//* global define:false */
define([
  'jquery',
  'views/base',
  'hbs!./tmpl/troupeAvatar',
  'bootstrap_tooltip'
], function($, TroupeViews, template) {

  "use strict";

  return TroupeViews.Base.extend({
    tagName: 'div',
    template: template,
    initialize: function(options) {
      // var self = this;
      if(!this.model) this.model = options.troupe;
      this.hasUnread = false;
      this.listenTo(this.model, 'change:unreadItems', this.unreadItemsChanged);
    },

    unreadItemsChanged: function() {
      var newUnread = this.model.get('unreadItems') > 0;
      if(this.hasUnread !== newUnread) {
        this.hasUnread = newUnread;
        var $e = this.$el.find('.trpDPUnreadCount');

        if(newUnread) {
          $e.css({ display: 'block' }).removeClass('bounceOut').addClass('animated bounceIn');
        } else {
          $e.removeClass('bounceIn').addClass('animated bounceOut');
          window.setTimeout(function() { $e.css({ display: 'none' }); } , 600);
        }
      }
    },

    afterRender: function() {
      this.unreadItemsChanged();
      this.$el.find(':first-child').tooltip({
        html : true,
        placement : function(a, element) {
          var position = $(element).position();
          if (position.top < 110){
            return "bottom";
          }

          return "top";
        },
        container: "body"
      });
    }

  });

});
