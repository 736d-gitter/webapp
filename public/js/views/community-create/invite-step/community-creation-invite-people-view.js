'use strict';

var _ = require('underscore');
var Backbone = require('backbone');
var stepConstants = require('../step-constants');
var template = require('./community-creation-invite-people-view.hbs');
var CommunityCreateBaseStepView = require('../shared/community-creation-base-step-view');
var CommunityCreationPeopleListView = require('../shared/community-creation-people-list-view');
var UserResultListView = require('../shared/community-create-invite-user-result-list-view');
var UserResultCollection = require('../shared/community-create-user-result-collection');
var avatars = require('gitter-web-avatars');

require('@gitterhq/styleguide/css/components/headings.css');
require('@gitterhq/styleguide/css/components/buttons.css');

var _super = CommunityCreateBaseStepView.prototype;

module.exports = CommunityCreateBaseStepView.extend({
  template: template,

  className: 'community-create-step-wrapper community-create-invite-people-step-wrapper',

  behaviors: {
    Isomorphic: {
      userResultListView: {
        el: '.community-create-invite-user-result-list-root',
        init: 'initUserResultListView'
      },
      inviteListView: { el: '.community-create-invite-list-root', init: 'initInviteListView' }
    }
  },

  initUserResultListView: function(optionsForRegion) {
    this.userResultListView = new UserResultListView(
      optionsForRegion({
        collection: this.userResultCollection
      })
    );

    this.listenTo(this.userResultListView, 'user:activated', this.onPersonSelected, this);
    return this.userResultListView;
  },

  initInviteListView: function(optionsForRegion) {
    this.inviteListView = new CommunityCreationPeopleListView(
      optionsForRegion({
        collection: this.communityCreateModel.invites,
        communityCreateModel: this.communityCreateModel,
        allowRemove: true
      })
    );

    this.listenTo(this.inviteListView, 'invite:remove', this.onInviteRemoved, this);
    return this.inviteListView;
  },

  ui: _.extend({}, _super.ui, {
    peopleInput: '.js-community-invite-people-name-input',
    emailForm: '.js-community-invite-people-email-form',
    emailInput: '.js-community-invite-people-email-input',
    emailSubmit: '.js-community-invite-people-email-submit-button'
  }),

  events: _.extend({}, _super.events, {
    'input @ui.peopleInput': 'onPeopleInputUpdate',
    'submit @ui.emailForm': 'onEmailSubmit'
  }),

  initialize: function() {
    _super.initialize.apply(this, arguments);

    this.searchModel = new Backbone.Model({
      searchInput: ''
    });

    this.userResultCollection = new UserResultCollection(null, {
      stepViewModel: this.model,
      searchModel: this.searchModel,
      communityCreateModel: this.communityCreateModel
    });
  },

  nextStep: function() {
    if (this.communityCreateModel.hasInvitesRequiringEmailEntry()) {
      // Only go to confirmation if there was trouble
      return stepConstants.INVITE_CONFIRMATION;
    } else {
      return stepConstants.OVERVIEW;
    }
  },
  prevStep: stepConstants.MAIN,

  onPeopleInputUpdate: function() {
    this.searchModel.set('searchInput', this.ui.peopleInput[0].value);
  },

  onPersonSelected: function(person) {
    // The person can either be from user-search or from suggestions
    // Unfortunately this means that the shape of the object will
    // be different. For now, we just guess from the shape of the object

    var type = person.get('type');
    var externalId = person.get('externalId');
    if (!type) {
      // For now, search results come from GitHub
      // TODO: when we add a local user search, adjust the type here
      type = 'github';
      externalId = person.get('username');
    }

    var avatarUrl = person.get('avatarUrl');
    var displayName = person.get('displayName');

    if (type && externalId) {
      this.communityCreateModel.addInvitation(type, externalId, displayName, avatarUrl);
    }
  },

  onInviteRemoved: function(invite) {
    this.communityCreateModel.invites.remove(invite);
  },

  onEmailSubmit: function(e) {
    var newEmailAddress = this.ui.emailInput[0].value;

    if (newEmailAddress.length) {
      var avatarUrl = avatars.getForGravatarEmail(newEmailAddress);
      this.communityCreateModel.addInvitation('email', newEmailAddress, newEmailAddress, avatarUrl);
    }

    // Clear the input
    this.ui.emailInput[0].value = '';

    e.preventDefault();
  }
});
