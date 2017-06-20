/*jshint strict:true, undef:true, unused:strict, browser:true *//* global define:false */
define([
  'marionette',
  'backbone',
  'views/base',
  'collections/base',
  'hbs!./tmpl/repoSelectView',
  'hbs!./tmpl/repoItemView',
  'hbs!./tmpl/repoEmptyView',
  'collections/repos',
  'cocktail',
  'views/controls/selectable-mixin',
  'views/controls/live-search',
  'filtered-collection' /* no ref */
], function(Marionette, Backbone, TroupeViews, TroupeCollections, template, itemTemplate,
  emptyTemplate, repoModels, cocktail, SelectableMixin, liveSearch) {
  "use strict";

  // TODO: put this somewhere else
  var FilteredLoadingCollection = Backbone.FilteredCollection.extend({ });
  cocktail.mixin(FilteredLoadingCollection, TroupeCollections.UnderlyingLoadingMixin);

  var ItemView = Marionette.ItemView.extend({
    template: itemTemplate,
    tagName: 'li',
    onRender: function() {
      this.el.dataset.cid = this.model.cid;
    }
  });

  var EmptyView = Marionette.ItemView.extend({
    template: emptyTemplate,
    tagName: 'li'
  });

  var View = Marionette.CompositeView.extend({
    events: {
    },
    ui: {
      search: "input#search"
    },
    itemViewContainer: '#list',
    itemView: ItemView,
    emptyView: EmptyView,
    template: template,
    onRender: function() {
      liveSearch(this, this.ui.search, 'searchTextChanged', { shortDebounce: 50, longDebounce: 200 });
    },
    searchTextChanged: function(text) {
      this.collection.setFilter(function(m) {
        return m.get('name').indexOf(text) >= 0;
      });
    }
  });

  View.createCollection = function()  {
    var underlying = new repoModels.ReposCollection();
    underlying.fetch();

    var c = new FilteredLoadingCollection(null, { model: repoModels.RepoModel, collection: underlying });
    c.setFilter(function() {
      return true;
    });

    return c;
  };

  cocktail.mixin(View, TroupeViews.LoadingCollectionMixin, SelectableMixin, TroupeViews.SortableMarionetteView);

  return View;

});
