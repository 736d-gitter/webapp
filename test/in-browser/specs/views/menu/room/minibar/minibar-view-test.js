"use strict";

var assert = require('assert');
var Backbone = require('backbone');
var MinibarView = require('../../../../../../../public/js/views/menu/room/minibar/minibar-view');

describe('MinibarView', function(){
  var el;
  var model;
  var collection;
  beforeEach(function(){
    el = document.createElement('div');
    model = new Backbone.Model();

    collection = new Backbone.Collection([
      { type: 'org', name: 'gitterHQ', id: 1 },
      { type: 'org', name: 'troupe', id: 2 }
    ]);

    model.minibarHomeModel = new Backbone.Model({ type: 'all', name: 'all' });
    model.minibarSearchModel = new Backbone.Model({ type: 'search', name: 'search' });
    model.minibarPeopleModel = new Backbone.Model({ type: 'people', name: 'people' });
    model.minibarCommunityCreateModel = new Backbone.Model({ name: 'Create Community', type: 'community-create' });
    model.minibarCloseModel = new Backbone.Model({ type: 'close', name: 'close' });

    new MinibarView({
      el: el,
      model: model,
      collection: collection
    });
  });

  describe('reacting to changes of menu state', function(){

    it('it should set active on the home model when the model changes state to all', function(){
      model.set('state', 'all');
      assert(model.minibarHomeModel.get('active'));
      assert(model.minibarHomeModel.get('focus'));
    });

    it('it should set active on the search model when the model changes state to search', function(){
      model.set('state', 'search');
      assert(model.minibarSearchModel.get('active'));
      assert(model.minibarSearchModel.get('focus'));
    });

    it('it should set active on the people model when the model changes state to people', function(){
      model.set('state', 'people');
      assert(model.minibarPeopleModel.get('active'));
      assert(model.minibarPeopleModel.get('focus'));
    });

    it('it should set active on the correct org model when the model changes state to org', function(){
      model.set({ state: 'org', groupId: 1 });
      assert(collection.findWhere({ name: 'gitterHQ'}).get('active'));
      assert(collection.findWhere({ name: 'gitterHQ'}).get('focus'));
      model.set('groupId', 2);
      assert(collection.findWhere({ name: 'troupe'}).get('active'));
      assert(collection.findWhere({ name: 'troupe'}).get('focus'));
    });

    it('should blur previously active elements when menu changes state', function(){
      model.set('state', 'search');
      model.set('state', 'people');
      assert(!model.minibarSearchModel.get('active'));
      assert(!model.minibarSearchModel.get('focus'));
    });

  });


});
