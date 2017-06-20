/*global describe:true, it:true, beforeEach:true */
'use strict';

var assert          = require('assert');
var Backbone        = require('backbone');
var PanelHeaderView = require('public/js/views/menu/room/header/header-view');

describe('PanelHeaderView', function() {

  var model;
  var userModel;
  var panelHeaderView;
  var el;

  beforeEach(function() {
    model           = new Backbone.Model({
      state: 'all',
      profileMenuOpenState: false,
      panelOpenState: true,
    });
    userModel       = model.userModel = new Backbone.Model();
    el              = document.createElement('div');
    panelHeaderView = new PanelHeaderView({ el: el, model: model });
    panelHeaderView.render();
  });

  it('should render the correct initial content', function() {
    var result = panelHeaderView.$el.find('.panel-header__title--all').length;
    assert.equal(1, result);

  });

  it('should render the correct content when in the search state', function() {
    model.set('state', 'search');
    var result = panelHeaderView.$el.find('.panel-header__title--search');
    assert.equal(1, result.length);
  });

  it('should render the correct content when in the favourite state', function() {
    model.set('state', 'favourite');
    var result = panelHeaderView.$el.find('.panel-header__title--favourite');
    assert.equal(1, result.length);
  });

  it('should render the correct content when in the people state', function() {
    model.set('state', 'people');
    var result = panelHeaderView.$el.find('.panel-header__title--people');
    assert.equal(1, result.length);
  });

  it('should render the correct content when in the people state', function() {
    model.set('state', 'org');
    var result = panelHeaderView.$el.find('.panel-header__title--org');
    assert.equal(1, result.length);
  });

  it('should toggle the profileMenuOpenState when clicked', function() {
    assert.ok(!model.get('profileMenuOpenState'));
    el.click();
    assert.ok(model.get('profileMenuOpenState'));
    el.click();
    assert.ok(!model.get('profileMenuOpenState'));
  });

  it('should change the panelMenuOpenState when the close button is clicked', function() {
    model.set('profileMenuOpenState', true);
    assert.ok(model.get('profileMenuOpenState'));
    panelHeaderView.render();
    panelHeaderView.$el.find('#menu-panel-header-close').click();
    assert.ok(!model.get('profileMenuOpenState'));
  });

  it('should change the panelOpenState when the close button is clicked', function() {
    assert.ok(model.get('panelOpenState'));
    panelHeaderView.render();
    panelHeaderView.$el.find('#menu-panel-header-close').click();
    assert.ok(!model.get('panelOpenState'));
  });

});
