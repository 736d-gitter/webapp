/*jshint strict:true, undef:true, unused:strict, browser:true *//* global define:false */

define([
  'jquery',
  'underscore',
  'utils/context',
  'views/base',
  'hbs!./tmpl/loginModalView',
  'jquery-placeholder'
], function($, _, context, TroupeViews, template) {
  "use strict";

  return TroupeViews.Base.extend({
    template: template,

    initialize: function(options) {
      if (options) {
        this.noAutofocus = options.noAutofocus;
        this.initialEmail = options.email;
        this.fromSignup = options.fromSignup;
        this.userExists = options.userExists;
      }
      _.bindAll(this, 'onFormSubmit');
    },

    getRenderData: function() {
      var troupe = context.getTroupe();
      return {
        userExists: this.userExists,
        email: this.initialEmail,
        autofocusEmail: !this.initialEmail && !this.noAutofocus ? 'autofocus' : '',
        autofocusPassword: this.initialEmail && !this.noAutofocus ? 'autofocus' : '',
        troupeUri: this.fromSignup ? null : window.location.pathname.replace(/\//g,''),
        fromSignup: this.fromSignup,
        isOneToOne: troupe && troupe.oneToOne
      };
    },

    afterRender: function() {
      var loginEl = this.$el.find('#email');
      loginEl.placeholder();
      var passwordEl = this.$el.find('#password');
      passwordEl.placeholder();
    },

    events: {
      "submit form": "onFormSubmit",
      "click .button-request-new-password" : "resetClicked",
      "click #send-reset" : "sendResetClicked",
      "click #go-back" : "backClicked",
      "click #button-close" : "closeClicked",
      "click .button-resend-confirmation": "resendConfirmation",
      "click #new-user": "showRequestAccess"
    },

    backClicked: function() {
      this.$el.find('.login-content').show();
      this.$el.find('.resetpwd-content').hide();
      this.$el.find('.resetpwd-failed').hide();
    },

    resetClicked: function() {
      this.$el.find('.login-content').hide();
      this.$el.find('.resetpwd-content').show();
      this.$el.find('#resetEmailAddress').text(this.$el.find('#email').val());
      return false;
    },

    closeClicked: function() {
      this.trigger('login.close');
    },

    sendResetClicked: function() {
      var that = this;
      var form = this.$el.find('form');
      $.ajax({
        url: "/reset",
        contentType: "application/x-www-form-urlencoded",
        dataType: "json",
        data: form.serialize(),
        type: "POST",
        success: function(data) {
          if(data.failed) {
            that.$el.find('.resetpwd-content').hide();
            that.$el.find('.resetpwd-failed').show();
          }
          else {
            that.$el.find('.resetpwd-content').hide();
            that.$el.find('#resetEmail').text(that.$el.find('#email').val());
            that.$el.find('.resetpwd-confirm').show();
          }
        }
      });

    },

    markUserAsExisting: function(email) {
      try {
        window.localStorage.defaultTroupeEmail = email;
      } catch(e) {
      }
    },

    onFormSubmit: function(e) {
      $('.login-failure').hide();
      this.$el.find('#email, #password').blur();
      if(e) e.preventDefault();
      var form = this.$el.find('form');
      var that = this;

      that.$el.find('.login-message').hide('fast');

      $.ajax({
        url: "/login",
        contentType: "application/x-www-form-urlencoded",
        dataType: "json",
        data: form.serialize(),
        type: "POST",
        error: function(jqXHR, textStatus, errorThrown) {
          if(jqXHR.status == 401) {

            try {
              var data = jQuery.parseJSON(jqXHR.responseText);

              if(data.reason === "account_not_activated") {
                that.$el.find('.login-failure-account-not-activated').show('fast');
                return;
              }
            } catch(e) {
            }
          }
          that.$el.find('.login-failure').show('fast');
        },
        success: function(data) {
          if(data.failed) {
            that.$el.find('.login-failure').show('fast');
            return;
          }
          that.markUserAsExisting(that.$el.find('#email').val());
          that.trigger('login.complete', data);
        }
      });
    },

    resendConfirmation: function(e) {
      if(e) e.preventDefault();
      var form = this.$el.find('form');
      var that = this;

      that.$el.find('.login-message').hide('fast');

      $.ajax({
        url: "/resendconfirmation",
        contentType: "application/x-www-form-urlencoded",
        dataType: "json",
        data: form.serialize(),
        type: "POST",
        success: function(data) {
          that.$el.find('.login-content').hide('fast');
          that.$el.find('.resend-confirm').show('fast');
        }
      });
    },

    getEmail: function() {
      return this.$el.find('input[name=email]').val();
    },

    showRequestAccess: function() {
      this.trigger('request.access');
    }
  });

});
