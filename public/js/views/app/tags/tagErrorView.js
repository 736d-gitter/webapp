/* jshint node: true */
"use strict";

var Backbone = require('backbone');
var Marionette = require('backbone.marionette');
var tagErrorTemplate = require('./tmpl/tagErrorTemplate.hbs');

var TagErrorView = Marionette.ItemView.extend({

  template: tagErrorTemplate,

  model: new Backbone.Model({tag: ''}),

  initialize: function(){
    this.hide();
    this.listenTo(this.collection, 'tag:error:duplicate', this.showError);
    this.listenTo(this.collection, 'tag:added', this.hide);
    this.listenTo(this.model, 'change', this.render);
  },

  showError: function(tag){
    var message = tag + ' has already been entered';
    this.model.set({ message: message, class: 'error' });
    this.show();
  },

  showMessage: function(msg){
    this.model.set({ message: msg, class: 'message' });
    this.show();
  },

  show: function(){
    this.$el.show();
  },

  hide: function(){
    this.$el.hide();
  }

});

module.exports = TagErrorView;
