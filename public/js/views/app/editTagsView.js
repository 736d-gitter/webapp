/* jshint node:true  */
"use strict";

var Backbone = require('backbone');
var Marionette = require('backbone.marionette');

var ModalView = require('views/modal');
var TagInputView = require('./tags/tagInputView');
var TagListView = require('./tags/tagListView');
var TagErrorView = require('./tags/tagErrorView');

var TagCollection = require('../../collections/tag-collection').TagCollection;

var apiClient = require('components/apiClient');

var editTagsTemplate = require('./tmpl/editTagsTemplate.hbs');

require('views/behaviors/isomorphic');

var View = Marionette.LayoutView.extend({
  template: editTagsTemplate,

  behaviors: {
    Isomorphic: {
      tagList:  { el: '#tag-list',  init: 'initTagList' },
      tagInput: { el: '#tag-input', init: 'initTagListEdit' },
      tagError: { el: '#tag-error', init: 'initTagError'}
    }
  },

  initialize: function() {

    //TODO --> Fix meta key in OSX chrome changing messages to read ctrl for now
    //jp 5/8/15
    //detect OS to get meta key value
    //var meta = /^MacIntel/.test(navigator.platform) ? 'cmd' : 'ctrl';
    var meta = 'ctrl';

    var tagCollection = new TagCollection();
    var errorModel = new Backbone.Model({
      message: 'Press '+ meta + '+backspace or delete to remove the last tag',
      class: 'message'
    });

    this.model = new Backbone.Model({
      tagCollection: tagCollection,
      errorModel: errorModel,
      meta: meta
    });

    //get existing tags
    ////TODO need to add error states to the below request
    apiClient.get('/v1/rooms/' + this.options.roomId)
    .then(function(data){
      this.model.set(data);
      this.model.get('tagCollection').add(data.tags);
    }.bind(this));

    //events
    this.listenTo(tagCollection, 'tag:error:duplicate', this.onDuplicateTag);
    this.listenTo(tagCollection, 'tag:added', this.onTagEmpty);
  },

  save: function(e, shouldHideDialog) {
    if(e) e.preventDefault();
    //TODO --> need to add error states here jp 3/9/15
    apiClient.put('/v1/rooms/' + this.options.roomId, { tags: this.model.get('tagCollection').toJSON() })
    .then(function() {
      if(shouldHideDialog) this.dialog.hide();
    }.bind(this));
  },

  onDuplicateTag: function(tag){
    this.model.get('errorModel').set({
     message: tag + ' has already been entered',
     isError: false
    });
  },

  childEvents: {
    'tag:valid': 'onTagValid',
    'tag:error': 'onTagError',
    'tag:warning:empty': 'onTagEmpty',
    'tag:removed': 'onTagRemoved',
    'tag:added': 'onTagAdded'
  },

  onTagEmpty: function(){
    this.model.get('errorModel').set({
     message: 'Press '+ this.model.get('meta') +'+backspace or delete to remove the last tag',
     isError: false
    });
  },

  onTagValid: function(model, value){
    model.get('errorModel').set({
      message: 'Press enter to add ' + value,
      isError: false
    });
  },

  onTagError: function(){
    this.model.get('errorModel').set({
      message: 'Tags must be between 1 and 20 characters in length',
      isError: true
    });
  },

  onTagRemoved: function(){
    this.tagInput.currentView.focus();
    this.save();
  },

  onTagAdded: function (){
    this.save();
  },

  initTagList: function(optionsForRegion){
    return new TagListView(optionsForRegion({ collection: this.model.get('tagCollection') }));
  },

  initTagListEdit: function(optionsForRegion){
    return new TagInputView(optionsForRegion({ collection: this.model.get('tagCollection') }));
  },

  initTagError: function(optionsForRegion){
    return new TagErrorView(optionsForRegion({ model: this.model.get('errorModel') }));
  }

});

var Modal = ModalView.extend({
  initialize: function(options) {
    options.title = "Edit tags";
    ModalView.prototype.initialize.apply(this, arguments);
    this.view = new View({roomId: options.roomId });
  }
});

module.exports = Modal;
