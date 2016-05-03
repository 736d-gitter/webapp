'use strict';

var Marionette = require('backbone.marionette');

var template = require('./community-create-view.hbs');
var CommunityCreateModel = require('./community-create-model');
var CommunityCreateStepViewModel = require('./community-create-step-view-model');
var CommunityCreationMainView = require('./views/community-creation-main-view');
var CommunityCreationInvitePeopleView = require('./views/community-creation-invite-people-view');

require('views/behaviors/isomorphic');

// Bounds input index to somewhere in [0, length] with wrapping/rollover
var arrayBoundWrap = function(index, length) {
  return ((index % length) + length) % length;
};


module.exports = Marionette.LayoutView.extend({
  template: template,

  behaviors: {
    Isomorphic: {
      mainStepView: { el: '.community-create-main-step-root', init: 'initMainStepView' },
      invitePeopleStepView: { el: '.community-create-invite-people-step-root', init: 'initInvitePeopleView' },
    },
  },

  initMainStepView: function(optionsForRegion) {
    this.mainStepView = new CommunityCreationMainView(optionsForRegion({
      model: this.mainStepViewModel,
      communityCreateModel: this.communityCreateModel
    }));
    this.listenTo(this.mainStepView, 'step:next', this.onStepInDirection.bind(this, 1), this);
    this.listenTo(this.mainStepView, 'step:back', this.onStepInDirection.bind(this, -1), this);
    return this.mainStepView;
  },

  initInvitePeopleView: function(optionsForRegion) {
    this.invitePeopleStepView = new CommunityCreationInvitePeopleView(optionsForRegion({
      model: this.invitePeopleStepViewModel,
      communityCreateModel: this.communityCreateModel
    }));
    this.listenTo(this.invitePeopleStepView, 'step:next', this.onStepInDirection.bind(this, 1), this);
    this.listenTo(this.invitePeopleStepView, 'step:back', this.onStepInDirection.bind(this, -1), this);
    return this.invitePeopleStepView;
  },

  initialize: function(options) {
    this.communityCreateModel = new CommunityCreateModel();
    this.mainStepViewModel = new CommunityCreateStepViewModel({ active: true });
    this.invitePeopleStepViewModel = new CommunityCreateStepViewModel({ active: false });

    this.modelStepOrder = [
      this.mainStepViewModel,
      this.invitePeopleStepViewModel
    ];
  },

  onStepInDirection: function(dir, args) {
    dir = (dir === false) ? -1 : Math.sign(dir || 1);
    var currentActiveModel = args.model;

    var nextActiveModel;
    this.modelStepOrder.some(function(model, index) {
      if(model === currentActiveModel) {
        nextActiveModel = this.modelStepOrder[arrayBoundWrap(index + 1, this.modelStepOrder.length)];
        // break
        return true;
      }
    }.bind(this));

    if(nextActiveModel) {
      currentActiveModel.set('active', false);
      nextActiveModel.set('active', true);
    }
  }
});
