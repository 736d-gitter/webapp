define([
  'marionette',
  'views/base',
  'views/widgets/avatar',
  'hbs!./tmpl/peopleCollectionView',
  'hbs!./tmpl/remainingView'
], function(Marionette, TroupeViews, AvatarView, collectionTemplate, remainingTempate) {
  "use strict";

  var PeopleCollectionView = Marionette.CollectionView.extend({
    tagName: 'ul',
    className: 'roster',
    itemView: AvatarView,
    itemViewOptions: function() {
      return { tagName: 'li', showStatus: true, tooltipPlacement: 'left' };
    },
    initialize: function() {
      this.listenTo(this.collection, 'sort reset', this.render);
    }
  });

  var RemainingView = Marionette.ItemView.extend({
    // tagName: 'p',
    className: 'remaining',
    template: remainingTempate,
    initialize: function(options) {
      this.rosterCollection = options.rosterCollection;
      this.userCollection = options.userCollection;
      this.listenTo(this.rosterCollection, 'add remove reset', this.render);
      this.listenTo(this.userCollection, 'add remove reset', this.render);
    },
    serializeData: function() {
      var remainingCount = this.userCollection.length - this.rosterCollection.length;
      return {
        remainingCount: remainingCount,
        plural: remainingCount > 1
      };
    },
    onRender: function() {
      var showMore = this.$('.js-show-more');
      showMore.hide();
      var remainingCount = this.userCollection.length - this.rosterCollection.length;

      if (remainingCount > 0) {
        showMore.show();
        this.$el.toggleClass('showFull');
      }

      this.$el.toggleClass('showMid', this.rosterCollection.length > 10);
    }
  });

  var ExpandableRosterView = Marionette.Layout.extend({
    template: collectionTemplate,

    regions: {
      roster: "#roster",
      remaining: "#remaining"
    },

    initialize: function(options) {
      this.rosterCollection = options.rosterCollection;
      this.userCollection = options.userCollection;
    },

    onRender: function() {
      this.roster.show(new PeopleCollectionView({
        collection: this.rosterCollection
      }));

      this.remaining.show(new RemainingView({
        rosterCollection: this.rosterCollection,
        userCollection: this.userCollection
      }));
    }
  });

  var AllUsersModal = TroupeViews.Modal.extend({
    initialize: function(options) {
      options = options || {};
      options.title = "People";
      TroupeViews.Modal.prototype.initialize.call(this, options);
      this.view = new PeopleCollectionView(options);
    }
  });

  return {
    ExpandableRosterView: ExpandableRosterView,
    Modal: AllUsersModal
  };

});
