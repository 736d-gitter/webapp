'use strict';

var Marionette   = require('backbone.marionette');
var Backbone     = require('backbone');
var itemTemplate = require('./profile-menu-item-view.hbs');

var profileCollection = new Backbone.Collection([
  { name: 'Home', url: '/home' },
  { name: 'Billing', url: 'http://billing.gitter.im/accounts'},
  { name: 'Get Gitter Apps', url: '/apps'},
  { name: 'Sign Out', url: '/logout' }
]);

var ItemView = Marionette.ItemView.extend({
  tagName: 'li',
  className: 'profile-menu__item',
  template: itemTemplate
});

module.exports = Marionette.CollectionView.extend({

  tagName: 'ul',
  className: 'profile-menu',
  childView: ItemView,

  constructor: function (){
    this.collection = profileCollection;
    Marionette.CollectionView.prototype.constructor.apply(this, arguments);
  },

  modelEvents: {
    'change:profileMenuOpenState': 'onOpenStateChange',
  },

  onOpenStateChange: function(model, val) {/*jshint unused:true */
    if (this.model.get('state') !== 'all') return;
    this.$el.toggleClass('active', !!val);
  },
});
