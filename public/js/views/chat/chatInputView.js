/*jshint strict:true, undef:true, unused:strict, browser:true *//* global define:false */
define([
  'jquery',
  'utils/context',
  'views/base',
  'utils/appevents',
  'hbs!./tmpl/chatInputView',
  'utils/momentWrapper',
  'utils/safe-html',
  'jquery-placeholder', // No ref
  'jquery-sisyphus' // No ref
], function($, context, TroupeViews, appEvents, template, moment, safeHtml) {
  "use strict";

  var chatFrameSelector = '#content-wrapper';
  var chatFrameProperty = 'margin-bottom';

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

  var chatPadding = parseInt($(chatFrameSelector).css(chatFrameProperty),10);
  var originalChatPadding = chatPadding;

  var ChatInputBoxView = TroupeViews.Base.extend({

    events: {
      "keyup": "detectNewLine",
      "keydown":  "detectReturn",
      "focusout": "onFocusOut"
    },

    // pass in the textarea as el for ChatInputBoxView
    // pass in a scroll delegate
    initialize: function(options) {
      this.chatLines = 2;

      this.rollers = options.rollers;
      this.originalChatInputHeight = this.$el.height();
      this.$el.placeholder();

      this.resizeInput();
    },

    onFocusOut: function() {
      if (this.compactView) this.send();
    },

    resetInput: function() {
      this.chatLines = 2;
      chatPadding = originalChatPadding;
      this.$el.height(this.originalChatInputHeight);
      $(chatFrameSelector).css(chatFrameProperty, chatPadding);

    },

    resizeInput: function() {
      var lht = parseInt(this.$el.css('lineHeight'),10);
      var height = this.$el.prop('scrollHeight');
      var currentLines = Math.floor(height / lht);

      if (currentLines != this.chatLines) {
        this.chatLines = currentLines;
        var newHeight = currentLines * lht;

        this.$el.height(newHeight);
        var frameChat = $(chatFrameSelector), isChild = frameChat.find(this.el).length;
        if (!isChild) {
          chatPadding = originalChatPadding + Math.abs(this.originalChatInputHeight - newHeight);
          frameChat.css(chatFrameProperty, chatPadding);
        }

        var self = this;
        window.setTimeout(function() {
          self.rollers.adjustScroll();
        }, 100);


        chatPadding = originalChatPadding + Math.abs(this.originalChatInputHeight - newHeight);
      }
    },

    detectNewLine: function(e) {
      if (e.keyCode ==13 && (e.ctrlKey || e.shiftKey)) {
        if (window._troupeCompactView !== true) this.resizeInput();
      }
    },

    detectReturn: function(e) {
      if(e.keyCode == 13 && (!e.ctrlKey && !e.shiftKey) && (!this.$el.val().match(/^\s+$/))) {
        if (window._troupeCompactView !== true) this.resetInput();
        e.stopPropagation();
        e.preventDefault();

        this.send();
        return;
      }

      if (window._troupeCompactView !== true) this.resizeInput();
    },

    send: function() {
      this.trigger('save', safeHtml(this.$el.val()));

      $('#chatInputForm').trigger('reset');
      this.$el.val('');
    }
  });

  return { ChatInputView: ChatInputView, ChatInputBoxView: ChatInputBoxView };
});
