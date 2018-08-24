'use strict';

var Marionette = require('backbone.marionette');
var Backbone = require('backbone');
var _ = require('underscore');
var log = require('../../utils/log');
var appEvents = require('../../utils/appevents');
var template = require('./profile-menu-view.hbs');
var itemTemplate = require('./profile-menu-item-view.hbs');
var toggleClass = require('../../utils/toggle-class');
var logout = require('../../utils/logout');
var isMobile = require('../../utils/is-mobile');
var isNative = require('../../utils/is-native');
var context = require('../../utils/context');
var toggleDarkTheme = require('../../utils/toggle-dark-theme');
var autoModelSave = require('../../utils/auto-model-save');
var showDesktopNotification = require('../../utils/show-desktop-notification');
var apiClient = require('../../components/api-client');
var frameUtils = require('gitter-web-frame-utils');

require('@gitterhq/styleguide/css/components/dropdowns.css');

function getProfileCollection() {

  var result = new Backbone.Collection([
    { name: 'Home', stub: '/home' },
  ]);

  var isWebApp = !isNative();
  var isMobileApp = isMobile();

  if(isWebApp && !isMobileApp) {
    result.add({ name: 'Get Gitter Apps', stub: '/apps'});
  }

  var user = context.user();

  // This is more fragile than i'd like it to be
  function showHideRepoAccess() {
    var scopes = user.get('scopes');
    var existing = result.find(function(f) { return f.get('upgradeItem') });

    if (!user.id || !scopes || scopes.private_repo) {
      // Hide the scope
      if (!existing) return;
      result.remove(existing);
    } else {
      // Show the scope
      if (existing) return;
      var appsItem = result.find(function(f) { return f.get('stub') === '/apps' });

      result.add({ name: 'Allow Private Repo Access', stub: '/login/upgrade?scopes=repo', upgradeItem: true }, {
        at: result.indexOf(appsItem) + 1
      });
    }
  }

  showHideRepoAccess();
  user.on('change:id', showHideRepoAccess);
  user.on('change:scopes', showHideRepoAccess);

  var currentTheme = hasDarkTheme() ? 'gitter-dark' : '';
  result.add({
    name: 'Toggle Dark Theme',
    stub: '#dark-theme',
    onClick(e) {
      e.preventDefault();

      var newTheme = (currentTheme === 'gitter-dark') ? '' : 'gitter-dark';

      toggleDarkTheme(!!newTheme.length);

      if(frameUtils.hasParentFrameSameOrigin()) {
        frameUtils.postMessage({ type: 'toggle-dark-theme', theme: newTheme });
      }

      apiClient.user.put('/settings/userTheme', { theme: newTheme })
        .catch((err) => {
          showDesktopNotification({
            title: 'Problem persisting /settings/userTheme',
            text: '(see devtools console for details)'
          });
          log.error('Problem persisting /settings/userTheme', { exception: err });
        });

      currentTheme = newTheme;
    }
  });

  result.add({ name: 'Terms of Service', stub: 'https://about.gitlab.com/terms/', target: '_blank' });

  result.add({ name: 'Contribute to Gitter', stub: 'https://gitlab.com/gitlab-org/gitter/webapp', target: '_blank' });

  result.add({
    name: 'Delete Account',
    onClick: (e) => {
      e.preventDefault();
      appEvents.trigger('route', 'delete-account');
    }
  });

  if(isWebApp) {
    result.add({
      name: 'Sign Out',
      stub: '/logout',
      onClick: (e) => {
        e.preventDefault();
        logout();
      }
    });
  }

  return result;
}

function hasDarkTheme(){
  var r = document.getElementById('gitter-dark');
  return !!r;
}

var ProfileMenuModel = Backbone.Model.extend({
  initialize: function() {
    autoModelSave(this, ['theme'], this.autoPersist);
  },
});

var ItemView = Marionette.ItemView.extend({
  tagName: 'li',
  className: 'dropdown__item--positive profile-menu__item',
  template: itemTemplate,
  events: {
    'click a': 'onItemClicked'
  },

  onItemClicked: function(e) {
    const cb = this.model.get('onClick');
    if (cb) {
      cb(e);
    }
  }
});

module.exports = Marionette.CompositeView.extend({
  template: template,
  childView: ItemView,
  childViewContainer: '#profile-menu-items',

  constructor: function() {
    this.collection = getProfileCollection();

    this.model = new ProfileMenuModel();

    //Super
    Marionette.CollectionView.prototype.constructor.apply(this, arguments);
  },

  ui: {
    menu: '#profile-menu-items'
  },

  events: {
    'click #profile-menu-avatar': 'onAvatarClicked',
    'mouseleave @ui.menu': 'onMouseLeave'
  },

  modelEvents: {
    'change:active': 'onActiveStateChange'
  },

  serializeData: function(){
    var data = this.model.toJSON();
    var user = context.user();
    return _.extend({}, data, {
      avatarUrl: user.get('avatarUrl'),
      username: user.get('username')
    });
  },

  onMouseLeave: function (){
    this.model.set('active', false);
  },

  onAvatarClicked: function(e){
    e.preventDefault();
    this.model.set({ active: true });
  },

  onActiveStateChange: function(){
    var state = this.model.get('active');
    toggleClass(this.ui.menu[0], 'hidden', !state);
  },

});
