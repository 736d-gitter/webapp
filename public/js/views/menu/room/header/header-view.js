'use strict';

var Marionette = require('backbone.marionette');
var template   = require('./header-view.hbs');
var fastdom    = require('fastdom');

module.exports = Marionette.ItemView.extend({

  template: template,

  modelEvents: {
    'change:state':                'updateActiveElement',
    'change:selectedOrgName':      'render',
    'change:profileMenuOpenState': 'onProfileToggle',
  },

  events: {
    'click':                          'onClick',
    'click #menu-panel-header-close': 'onCloseClicked',
  },

  ui: {
    headerAll:       '#panel-header-all',
    headerSearch:    '#panel-header-search',
    headerFavourite: '#panel-header-favourite',
    headerPeople:    '#panel-header-people',
    headerOrg:       '#panel-header-org',
    profileToggle:   '#panel-header-profile-toggle',
  },

  serializeData: function() {
    return {
      orgName:    this.model.get('selectedOrgName'),
    };
  },

  updateActiveElement: function(model, state) { //jshint unused: true
    //This can be called after render so we need to add a small delay to get the transitions working
    //jp 6/12/16
    setTimeout(function() {
      fastdom.mutate(function() {
        this.ui.headerAll[0].classList.toggle('active', state === 'all');
        this.ui.headerSearch[0].classList.toggle('active', state === 'search');
        this.ui.headerFavourite[0].classList.toggle('active', state === 'favourite');
        this.ui.headerPeople[0].classList.toggle('active', state === 'people');
        this.ui.headerOrg[0].classList.toggle('active', state === 'org');
      }.bind(this));
    }.bind(this));
  },

  onRender: function() {
    this.updateActiveElement(this.model, this.model.get('state'));
  },

  onClick: function() {
    //Open the profile menu ONLY when in the all channels state
    if (this.model.get('state') === 'all') {
      this.model.set('profileMenuOpenState', !this.model.get('profileMenuOpenState'));
    }
  },

  //TODO CHECK IF THIS CAN BE REMOVED JP 27/1/16
  onCloseClicked: function(e) {
    if (this.model.get('roomMenuIsPinned')) return;
    e.stopPropagation();
    this.model.set({
      profileMenuOpenState: false,
      panelOpenState:       false,
    });
  },

  onProfileToggle: function(model, val) { //jshint unused: true
    this.ui.profileToggle[0].classList.toggle('active', !!val);
  },

  onDestroy: function() {
    this.stopListening(this.model.primaryCollection);
  },

});