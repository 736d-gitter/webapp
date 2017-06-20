/* jshint unused:true, browser:true */
define([
  'jquery',
  'underscore',
  'backbone',
  'utils/context',
  '../base',
  'components/realtime',
  '../troupes',
  '../orgs',
  'components/unread-items-client',
  'filtered-collection' /* no ref */
], function($, _, Backbone, context, base, realtime, troupeModels, orgModels, unreadItemsClient) {
  "use strict";

  var orgsCollection = new orgModels.OrgCollection(null, { listen: true });
  orgsCollection.fetch();

  var troupeCollection = new troupeModels.TroupeCollection(null, { listen: true });
  unreadItemsClient.installTroupeListener(troupeCollection);

  function filterTroupeCollection(filter) {
    var c = new Backbone.FilteredCollection(null, { model: troupeModels.TroupeModel, collection: troupeCollection });
    c.setFilter(filter);
    return c;
  }

  // collection of normal troupes only
  var filteredTroupeCollection = filterTroupeCollection(function(m) {
    return !m.get('oneToOne') /* || m.get('unreadItems') > 0 */;
  });

  // collection of one to one troupes only
  var peopleOnlyTroupeCollection = filterTroupeCollection(function(m) {
    return m.get('oneToOne');
  });

  // collection of unread troupes only
  var unreadTroupeCollection = filterTroupeCollection(function(m) {
    return m.get('unreadItems') > 0;
  });

  // collection of favourited troupes
  var favouriteTroupesCollection = filterTroupeCollection(function(m) {
    return m.get('favourite');
  });

  // collection of troupes that are Repos
  var repoTroupeCollection = filterTroupeCollection(function(m) {
    return m.get('githubType') == "REPO";
  });


  // collection of recent troupes only, will be empty at first.
  // doesn't need to be connected to events from the main collection,
  // because this only changes when the page is refreshed
  // (TODO actually it changes when another window accesses it as well, but this change doesn't get pushed through faye yet)
  var recentTroupeCollection = new Backbone.Collection();

  // when the list of troupes come in filter them and put them in recentTroupeCollection
  troupeCollection.on('reset sync', function() {
    // filter out troupes that don't have a last access time
    var recentTroupeModels = _.filter(troupeCollection.models, function(v) {
      return !!v.get('lastAccessTime');
    });

    // sort the troupes by last accessed
    recentTroupeModels = _.sortBy(recentTroupeModels, function(v) {
      var lastAccess = v.get('lastAccessTime');

      return lastAccess.valueOf();
    }).reverse();

    // filter to the most recent 5
    recentTroupeModels = _.filter(recentTroupeModels, function(v, k) {
      return k < 5;
    });

    // set these as the models for recentTroupeCollection and send out a reset on that collection
    recentTroupeCollection.reset(recentTroupeModels);
    recentTroupeCollection.trigger('sync');

  });


  //var smartCollection = new SmartCollection(null, { troupes: troupeCollection });

  return {
    troupes: troupeCollection,
    peopleTroupes: peopleOnlyTroupeCollection,
    normalTroupes: filteredTroupeCollection,
    recentTroupes: recentTroupeCollection,
    unreadTroupes: unreadTroupeCollection,
    favouriteTroupes: favouriteTroupesCollection,
    //smart: smartCollection,
    orgs: orgsCollection,
    repos: repoTroupeCollection
  };

});
