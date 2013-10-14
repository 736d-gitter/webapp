/*jshint strict:true, undef:true, unused:strict, browser:true *//* global define:false */
define([
  'jquery',
  'utils/context',
  'views/base',
  'utils/appevents',
  'hbs!./tmpl/chatInputView',
  'utils/momentWrapper',
  'utils/safe-html',
  'utils/scrollbar-detect',
  'jquery-placeholder', // No ref
  'jquery-sisyphus' // No ref
], function($, context, TroupeViews, appEvents, template, moment, safeHtml, hasScrollBars) {
  "use strict";

  /** @const */
  var MAX_CHAT_HEIGHT = 145;

  /** @const */
  var EXTRA_PADDING = 10;

  var ChatInputView = TroupeViews.Base.extend({
    template: template,

    initialize: function(options) {
      this.rollers = options.rollers;
    },

    getRenderData: function() {
      return {
        user: context.user()
      };
    },

    afterRender: function() {
      this.inputBox = new ChatInputBoxView({
        el: this.$el.find('.trpChatInputBoxTextArea'),
        rollers: this.rollers
      });
      this.$el.find('form').sisyphus({locationBased: true}).restoreAllData();

      // http://stackoverflow.com/questions/16149083/keyboardshrinksview-makes-lose-focus/18904886#18904886
      this.$el.find("textarea").on('touchend', function(){
        var t = $(this);

        window.setTimeout(function() {
          t.focus();
        }, 300);

        return true;
      });

      this.listenTo(this.inputBox, 'save', this.send);
    },

    send: function(val) {
      if(val) {
        var model = this.collection.create({
          text: val,
          fromUser: context.getUser(),
          sent: moment()
        });
        appEvents.trigger('chat.send', model);
      }
      return false;
    }
  });

  var ChatCollectionResizer = function(options) {
    var compact = options.compactView;
    var rollers = options.rollers;
    var editMode = options.editMode;

    var el = options.el;
    var $el = $(el);

    var frameChat = $(compact ? '#content': '#content-wrapper').first();

    this.resetInput = function() {
      $el.css({ height: '', 'overflow-y': '' });

      var css = {};
      css[compact ? 'padding-bottom' : 'margin-bottom'] = '';
      frameChat.css(css);
      rollers.adjustScroll();
    };

    this.resizeInput = function() {
      var scrollHeight = el.scrollHeight;
      var height = scrollHeight > MAX_CHAT_HEIGHT ? MAX_CHAT_HEIGHT : scrollHeight;
      var offsetHeight = el.offsetHeight;
      if(offsetHeight == height) {
        return;
      }

      var overflow = height < scrollHeight ? 'scroll' : '';
      $el.css({ height: height, 'overflow-y': overflow });

      if (!editMode) {
        var css = {};

        if(compact) {
          frameChat.css({ 'padding-bottom': (height + EXTRA_PADDING) + 'px'});
        } else {
          frameChat.css({ 'margin-bottom': height + 'px'});

        }
        frameChat.css(css);
      }

      rollers.adjustScroll();
      window.setTimeout(function() {
        rollers.adjustScroll();
      }, 100);
    };

  };

  var ChatInputBoxView = TroupeViews.Base.extend({
    events: {
      "keydown":  "onKeyDown",
      "focusout": "onFocusOut"
    },

    // pass in the textarea as el for ChatInputBoxView
    // pass in a scroll delegate
    initialize: function(options) {
      this.$el.placeholder();

      if(hasScrollBars()) {
        this.$el.addClass("scroller");
      }

      this.chatResizer = new ChatCollectionResizer({
        compactView: this.compactView,
        el: this.el,
        editMode: this.options.editMode,
        rollers: options.rollers
      });

      this.chatResizer.resetInput();
    },

    onFocusOut: function() {
      if (this.compactView) this.send();
    },

    onKeyDown: function(e) {
      if(e.keyCode == 13 && (!e.ctrlKey && !e.shiftKey) && (!this.$el.val().match(/^\s+$/))) {
        e.stopPropagation();
        e.preventDefault();

        this.send();
        return;
      }
      this.chatResizer.resizeInput();
    },

    send: function() {
      this.trigger('save', safeHtml(this.$el.val()));
      $('#chatInputForm').trigger('reset');
      this.$el.val('');
      this.chatResizer.resetInput();
    }
  });

  return { ChatInputView: ChatInputView, ChatInputBoxView: ChatInputBoxView };
});
