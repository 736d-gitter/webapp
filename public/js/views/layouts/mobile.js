"use strict";

var context = require('utils/context');
var Marionette = require('backbone.marionette');
var modalRegion = require('components/modal-region');
var ChatContainerView = require('views/chat/chatContainerView');

/* Decorators */
var emojiDecorator = require('views/chat/decorators/emojiDecorator');
var TroupeMenu = require('views/menu/troupeMenu');
var mobileDecorator = require('views/chat/decorators/mobileDecorator');
var ChatInputView = require('views/chat/chatInputView');

var $ = require('jquery');

require('views/behaviors/isomorphic');

module.exports = Marionette.LayoutView.extend({
  template: false,
  el: 'body',
  dialogRegion: modalRegion,
  behaviors: {
    Isomorphic: {
      chat: { el: '#content-wrapper', init: 'initChatRegion' },
      menu: { el: '#menu-region', init: 'initMenuRegion' },
      input: { el: '#chat-input', init: 'initInputRegion' },
    }
  },

  ui: {
    mainPage: '#mainPage',
    showTroupesButton: '#showTroupesButton',
    scroll: '#content-frame'
  },

  events: {
    'click @ui.mainPage': 'hideTroupes',
    'click @ui.showTroupesButton': 'showHideTroupes'
  },

  initialize: function(options) {
    this.chatCollection = options.chatCollection;
    this.dialogRegion = modalRegion;
  },

  onRender: function() {
    this.ui.showTroupesButton.toggle(!this.options.hideMenu);
  },

  initChatRegion: function(optionsForRegion) {
    var chatCollectionView = new ChatContainerView(optionsForRegion({
      collection: this.options.chatCollection,
      decorators: [emojiDecorator, mobileDecorator],
      monitorScrollPane: this.ui.scroll // Monitor the scroll region for unread items
    }));

    return chatCollectionView;
  },

  initMenuRegion: function(optionsForRegion) {
    return new TroupeMenu(optionsForRegion());
  },

  initInputRegion: function(optionsForRegion) {
    return new ChatInputView(optionsForRegion({
      compactView: true,
      model: context.troupe(),
      collection: this.options.chatCollection,
    }));
  },

  hideTroupes: function() {
    this.makeAppFullScreen();
    this.ui.mainPage.removeClass('partiallyOffScreen');
  },

  makeAppFullScreen: function() {
    $('html, body').scrollTop($(document).height());
  },

  showHideTroupes: function(e) {
    this.makeAppFullScreen();
    this.ui.mainPage.toggleClass('partiallyOffScreen');
    e.stopPropagation();
  }

});
