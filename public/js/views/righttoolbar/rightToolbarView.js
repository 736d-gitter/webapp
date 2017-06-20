/*jshint strict:true, undef:true, unused:strict, browser:true *//* global define:false */
define([
  'jquery',
  'marionette',
  'views/base',
  'utils/context',
  // 'fineuploader',
  'hbs!./tmpl/rightToolbar',
  'collections/instances/integrated-items',
  'views/people/peopleCollectionView',
  'cocktail',
  './repoInfo',
  './activity',
  'utils/scrollbar-detect'
], function($, Marionette, TroupeViews, context, /*qq,*/ rightToolbarTemplate, itemCollections,
  PeopleCollectionView, cocktail, repoInfo, ActivityStream, hasScrollBars) {
  "use strict";

  var RightToolbarLayout = Marionette.Layout.extend({
    tagName: "span",
    template: rightToolbarTemplate,

    regions: {
      people: "#people-roster",
      repo_info: "#repo-info",
      activity: "#activity"
    },

    events: {
      'click #upgrade-auth': 'onUpgradeAuthClick',
      'click .activity-expand' : 'expandActivity',
      'click #people-header' : 'showPeopleList',
      'click #info-header' : 'showRepoInfo'
    },

    showPeopleList: function() {
      $('#repo-info').hide();
      $('#people-roster').show();

      $('#people-header').addClass('selected');
      $('#info-header').removeClass('selected');
    },

    showRepoInfo: function() {
      $('#people-roster').hide();
      $('#repo-info').show();
      $('#people-header').removeClass('selected');
      $('#info-header').addClass('selected');
    },

    serializeData: function() {
      var isRepo;
      if (context().troupe.githubType === 'REPO') {
        isRepo = true;
      }

      return {
        isRepo : isRepo
      };
    },

    onShow: function() {
       if (hasScrollBars()) {
        $(".trpToolbarContent").addClass("scroller");
      }
    },

    expandActivity: function() {
      $('.activity-expand .commits').slideToggle();
    },

    onRender: function() {
      $('#toolbar-frame').show();

      // userVoice.install(this.$el.find('#help-button'), context.getUser());

      // People View
      this.people.show(new PeopleCollectionView.ExpandableRosterView({
        rosterCollection: itemCollections.roster,
        userCollection: itemCollections.sortedUsers
      }));

      // Repo info
      if (context().troupe.githubType === 'REPO') {
        var repo = new repoInfo.model();
        repo.fetch({ data: $.param({repo: context().troupeUri })});
        this.repo_info.show(new repoInfo.view({ model: repo }));
      }

      // Activity
      this.activity.show(new ActivityStream({ collection: itemCollections.events }));

      itemCollections.events.on('add reset sync', function() {

        if (itemCollections.events.length >0) {
          this.$el.find('#activity-header').show();
          itemCollections.events.off('add reset sync', null, this);
        }
      }, this);

    },

  });
  cocktail.mixin(RightToolbarLayout, TroupeViews.DelayedShowLayoutMixin);

  return RightToolbarLayout;

});
