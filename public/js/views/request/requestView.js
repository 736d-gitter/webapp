/*jshint strict:true, undef:true, unused:strict, browser:true *//* global define:false */
define([
  'views/base',
  'marionette',
  'hbs!./tmpl/requestView',
  'hbs!./tmpl/requestItemView',
  'views/unread-item-view-mixin'
], function(TroupeViews, Marionette, requestViewTemplate, requestItemViewTemplate, UnreadItemViewMixin) {
  "use strict";

  var RequestItemView = TroupeViews.Base.extend({
    tagName: 'span',
    unreadItemType: 'request',
    template: requestItemViewTemplate,

    initialize: function(/*options*/) {
      this.setRerenderOnChange();
    }
  });
  _.extend(RequestItemView.prototype, UnreadItemViewMixin);

  return TroupeViews.Base.extend({
    template: requestViewTemplate,

    initialize: function(/*options*/) {
      this.collectionView = new Marionette.CollectionView({
        collection: this.collection,
        itemView: RequestItemView
      });

      var self = this;
      function updateVisibility() {
        self.setVisibility(true);
      }

      this.setVisibility(false);
      this.listenTo(this.collection, 'add', updateVisibility);
      this.listenTo(this.collection, 'remove', updateVisibility);
      this.listenTo(this.collection, 'reset', updateVisibility);
    },

    setVisibility: function(animate) {
      if (this.collection.length > 0) {
        return (animate) ? this.$el.parent().slideDown() : this.$el.parent().show();
      }
      else {
        return (animate) ? this.$el.parent().slideUp() : this.$el.parent().hide();
      }
    },

    afterRender: function() {
      this.$el.find('.frame-request').append(this.collectionView.render().el);
    }

  });

});