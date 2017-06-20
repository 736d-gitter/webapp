/*global describe:true, it:true, beforeEach:true */
'use strict';

var assert                    = require('assert');
var $                         = require('jquery');
var Backbone                  = require('backbone');
var PrimaryCollectionItemView = require('public/js/views/menu/room/primary-collection/primary-collection-item-view');
var apiClient                 = require('components/apiClient');
var appEvents                 = require('utils/appevents');
var context                   = require('utils/context');

describe('PrimartCollectionItemView', function() {

  var itemView;
  var el;

  beforeEach(function() {
    el = document.createElement('div');
    itemView = new  PrimaryCollectionItemView({
      index: 1,
      model: new Backbone.Model({
        name: 'gitterHQ',
      }),
      el: el,
    });
    itemView.render();
  });

  it('should toggle menuIsOpen on its uiModel when the options button is clicked', function() {
    itemView.render();
    var trigger = itemView.$el.find('[data-component=room-item-options-toggle]');
    assert(!itemView.uiModel.get('menuIsOpen'));
    trigger.click();
    assert(itemView.uiModel.get('menuIsOpen'));
    trigger.click();
    assert(!itemView.uiModel.get('menuIsOpen'));
  });

  it('should toggle a active class when the menuIsOpen changes', function() {
    assert(!itemView.el.classList.contains('active'));
    itemView.uiModel.set('menuIsOpen', true);
    assert(itemView.el.classList.contains('active'));
    itemView.uiModel.set('menuIsOpen', false);
    assert(!itemView.el.classList.contains('active'));
  });

  it('should change menuIsOpen to false when mouseleave happens', function() {
    assert(!itemView.uiModel.get('menuIsOpen'));
    itemView.uiModel.set('meuIsOpen', true);
    itemView.$el.mouseleave();
    assert(!itemView.uiModel.get('menuIsOpen'));
  });

  it('should call apiClient.user.delete when the hide link is clicked', function() {
    itemView.$el.find('[data-component="room-item-hide"]').click();
    assert.equal(1, apiClient.user.delete.callCount);
    assert(apiClient.user.delete.calledWith('/rooms/' + itemView.model.get('id')));
  });

  it('should trigger an event if it represents the current room when leave is clicked', function(done) {
    appEvents.on('about.to.leave.current.room', function() {
      assert.ok(true);
      done();
    });

    context.getTroupeId = function() { return itemView.model.get('id'); };

    itemView.$el.find('[data-component="room-item-leave"]').click();
  });

  it('should call apiClient delete when leave is clicked', function() {
    var apiUrl = '/v1/rooms/' + itemView.model.get('id') + '/users/' + context.getUserId();
    itemView.$el.find('[data-component="room-item-leave"]').click();
    assert(apiClient.delete.calledWith(apiUrl));
  });

  //TODO this fails when all tests are run
  it.skip('should trigger a navigation event if it represents the current room & leave is clicked', function(done) {
    appEvents.on('navigation', function(url, type) {
      assert.equal('/home', url);
      assert.equal('home', type);
      done();
    });

    context.getTroupeId = function() { return itemView.model.get('id'); };

    itemView.$el.find('[data-component="room-item-leave"]').click();
  });

  it('should toggle a selected class dependant on its models selected value', function(){
    assert(!itemView.el.firstChild.classList.contains('selected'));
    itemView.model.set('selected', true);
    assert(itemView.el.firstChild.classList.contains('selected'));
    itemView.model.set('selected', false);
    assert(!itemView.el.firstChild.classList.contains('selected'));
  });

});
