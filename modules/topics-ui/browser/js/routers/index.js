import { parse, stringify } from 'qs';
import Backbone from 'backbone';
import { subscribe } from '../../../shared/dispatcher';
import * as navConstants from '../../../shared/constants/navigation';
import * as forumCatConstants from '../../../shared/constants/forum-categories';
import * as forumFilterConstants from '../../../shared/constants/forum-filters';
import * as forumTagConstants from '../../../shared/constants/forum-tags';
import * as forumSortConstants from '../../../shared/constants/forum-sorts';


var RouteModel = Backbone.Model.extend({
  //Do we need to use the constructor to get the default values out of the window.context
  defaults: {
    route: null,
    createTopic: false
  }
});

var Router = Backbone.Router.extend({

  constructor: function() {
    this.model = new RouteModel();

    subscribe(forumCatConstants.NAVIGATE_TO_CATEGORY, this.updateForumCategory, this);
    subscribe(forumFilterConstants.NAVIGATE_TO_FILTER, this.updateForumFilter, this);
    subscribe(forumTagConstants.NAVIGATE_TO_TAG, this.updateForumTag, this);
    subscribe(forumSortConstants.NAVIGATE_TO_SORT, this.updateForumSort, this);
    subscribe(navConstants.NAVIGATE_TO_TOPIC, this.navigateToTopic, this);

    this.listenTo(this.model, 'change:filterName', this.onFilterUpdate, this);
    this.listenTo(this.model, 'change:sortName', this.onSortUpdate, this);

    Backbone.Router.prototype.constructor.call(this, ...arguments);
  },

  routes: {
    ':groupName/topics/create-topic(/)(~topics)': 'createTopic',
    ':groupName/topics(/categories/:categoryName)(/)(~topics)(?*queryString)': 'forums',
    ':groupName/topics/topic/:id/:slug(/)(~topics)(?*queryString)': 'topic'
  },

  navigate(url, options){

    //Remove ~topics from the url
    let appUrl = url.split('~')[0];

    //Remove the trailing slash
    if(appUrl[appUrl.length - 1] === '/') { appUrl = appUrl.substring(0, appUrl.length - 1); }
    if(appUrl[0] !== '/') { appUrl = '/' + appUrl; }

    //Generate payload
    const json = JSON.stringify({ type: 'navigation', url: appUrl, urlType: 'topics' });

    //Proxy up to the frame
    window.parent.postMessage(json, window.location.origin);

    //Call super
    Backbone.Router.prototype.navigate.call(this, url, options);
  },

  createTopic(groupName){
    this.model.set({
      route: navConstants.CREATE_TOPIC_ROUTE,
      groupName: groupName,
      categoryName: navConstants.DEFAULT_CATEGORY_NAME,
      createTopic: true,
    });
  },

  forums(groupName, categoryName, queryString){
    const query = parse(queryString || '');
    this.model.set({
      route: navConstants.FORUM_ROUTE,
      groupName: groupName,
      categoryName: (categoryName || navConstants.DEFAULT_CATEGORY_NAME),
      filterName: (query.filter || navConstants.DEFAULT_FILTER_NAME),
      tagName: (query.tag || navConstants.DEFAULT_TAG_NAME),
      sortName: (query.sort || navConstants.DEFAULT_SORT_NAME),
    });
  },

  topic(groupName, id, slug){
    this.model.set({
      route: navConstants.TOPIC_ROUTE,
      groupName: groupName,
      topicId: id,
      slug: slug
    });
  },

  updateForumCategory(data){
    var url = this.buildForumUrl(data.category);
    this.navigate(url, { trigger: true });
  },

  updateForumFilter(data) {
    var url = this.buildForumUrl(undefined, data.filter);
    this.navigate(url, { trigger: true });
  },

  updateForumTag(data){
    var url = this.buildForumUrl(undefined, undefined, data.tag);
    this.navigate(url, { trigger: true });
  },

  updateForumSort(data){
    var url = this.buildForumUrl(undefined, undefined, undefined, data.sort);
    this.navigate(url, { trigger: true });
  },

  onFilterUpdate(moidel, val){
    this.model.trigger(forumFilterConstants.UPDATE_ACTIVE_FILTER, { filter: val });
  },

  onSortUpdate(model, val){
    this.model.trigger(forumSortConstants.UPDATE_ACTIVE_SORT, { sort: val });
  },

  navigateToTopic(data){
    const url = `/${data.groupName}/topics/topic/${data.id}/${data.slug}/~topics`;
    this.navigate(url, { trigger: true });
  },

  buildForumUrl(categoryName, filterName, tagName, sortName){

    var groupName = this.model.get('groupName');
    categoryName = categoryName || this.model.get('categoryName');

    //Get current values and cancel anything that is a default
    filterName = (filterName || this.model.get('filterName'));
    if(filterName === navConstants.DEFAULT_FILTER_NAME) { filterName = undefined; }

    tagName = (tagName || this.model.get('tagName'));
    if(tagName === navConstants.DEFAULT_TAG_NAME) { tagName = undefined; }

    sortName = (sortName || this.model.get('sortName'));
    if(sortName === navConstants.DEFAULT_SORT_NAME) { sortName = undefined; }

    //Base URL
    let url = (categoryName === navConstants.DEFAULT_CATEGORY_NAME) ?
      `/${groupName}/topics/` :
      `${groupName}/topics/categories/${categoryName}/`;

    //QUERY STRING
    const query = stringify({
      filter: filterName,
      tag: tagName,
      sort: sortName,
    });

    if(query.length) { url = `${url}~topics?${query}`; }

    return url;

  },

});

var router = new Router();

//Deal with back/forward buttons
window.parent.addEventListener('popstate', function(e) {
  if(!e.state) { return; }
  const url = e.state.replace(window.location.origin, '');
  router.navigate(url, { trigger: true, replace: true });
});


export default router.model;
