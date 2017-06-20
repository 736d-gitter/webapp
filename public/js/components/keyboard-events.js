/*jshint strict:true, undef:true, unused:strict, browser:true *//* global require:false */
require([
  'utils/appevents',
  'utils/platform-keys',
  'underscore',
  'keymaster'
], function(appEvents, platformKeys, _, key) {
  "use strict";

  // Attach keyboard events listeners as specified by the keymaster library
  // They will we emitted to appEvents with the `keyboard.` prefix
  // Use views/keyboard-events-mixin to attach handlers for these events to Backbone components

  // Set modifier keys for the OS
  var cmdKey = platformKeys.cmd;
  var gitterKey = platformKeys.gitter;

  // Define different scopes for the key listeners
  // - 'input.chat' for the chat message input
  // - 'input.chat.edit' for the chat message edit input
  // - 'input.search' for the search input
  // - 'input.other' for other inputs (including textarea and select)
  // - 'other' for the rest
  key.filter = function(event) {
    var scope, tag = event.target || event.srcElement;
    if (tag.id === 'chat-input-textarea') {
      scope = 'input.chat';
    }
    else if (tag.id === 'list-search-input') {
      scope = 'input.search';
    }
    else if (tag.className === 'trpChatInput') {
      scope = 'input.chat.edit';
    }
    else if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag.tagName)) {
      scope = 'input.other';
    }
    else {
      scope = 'other';
    }
    key.setScope(scope);
    return true;
  };

  // Key mappings
  // Basic usage: 'key': 'event name', scope is 'all' by default
  // Set to a scope: 'key': {name, scope}, scope can be an Array
  // Multiple names/scopes: 'key': ['event name', {name, scope}, ...]
  var keyEvents = {
    'backspace': {
      name: 'backspace',
      scope: 'other'
    },
    'esc': [{
      name: 'chat.escape',
      scope: 'input.chat'
      },{
      name: 'chat.edit.escape',
      scope: 'input.chat.edit'
      },{
      name: 'search.escape',
      scope: 'input.search'
      },{
      name: 'maininput.escape',
      scope: ['input.chat', 'input.search']
      },{
      name: 'input.escape',
      scope: 'input.other'
      },{
      name: 'document.escape',
      scope: 'other'
    }],
    'enter': [{
      name: 'search.go',
      scope: 'input.search'
      },{
      name: 'room.enter',
      scope: 'other'
    }],
    'up': [{
      name: 'room.up',
      scope: 'other'
      },{
      name: 'chat.edit.openLast',
      scope: 'input.chat'
      },{
      name: 'search.prev',
      scope: 'input.search'
    }],
    'down': [{
      name: 'room.down',
      scope: 'other'
      },{
      name: 'search.next',
      scope: 'input.search'
    }],
    // 'left': {
    //   name: 'room.prev',
    //   scope: 'other'
    // },
    'right': {
      name: 'search.go',
      scope: 'input.search'
    },
    // {
    // name: 'room.next',
    // scope: 'other'
    // },
    'tab': {
      name: 'maininput.tab.next',
      scope: ['input.chat', 'input.chat.edit', 'input.search']
    },
    // ,{
    // name: 'tab.next',
    // scope: 'other'
    // }
    '⇧+tab': {
      name: 'maininput.tab.prev',
      scope: ['input.chat', 'input.chat.edit', 'input.search']
    },
    // ,{
    // name: 'tab.prev',
    // scope: 'other'
    // }
    'pageup': 'pageUp',
    'pagedown': 'pageDown',
    'q, r': {
      name: 'quote',
      scope: 'other'
    }
  };

  // OS-specific modifier key
  keyEvents['enter, ' + cmdKey + '+enter'] = [{
    name: 'chat.send',
    scope: 'input.chat'
    },{
    name: 'chat.edit.send',
    scope: 'input.chat.edit'
  }];

  keyEvents[cmdKey + '+/, ' + cmdKey + '+' + gitterKey + '+/'] = 'chat.toggle';
  keyEvents[cmdKey + '+' + gitterKey + '+f'] = 'focus.search';
  keyEvents[cmdKey + '+' + gitterKey + '+c'] = 'focus.chat';
  keyEvents[cmdKey + '+' + gitterKey + '+m'] = 'help.markdown';
  keyEvents[cmdKey + '+' + gitterKey + '+k'] = 'help.keyboard';

  keyEvents[cmdKey + '+' + gitterKey + '+up'] = 'room.up';
  keyEvents[cmdKey + '+' + gitterKey + '+down'] = 'room.down';
  keyEvents[cmdKey + '+' + gitterKey + '+left'] = 'room.prev';
  keyEvents[cmdKey + '+' + gitterKey + '+right'] = 'room.next';
  keyEvents[cmdKey + '+' + gitterKey + '+enter'] = 'room.enter';

  // Go to a conversation by index in favourites
  _.each('123456789'.split(''), function(n) {
    keyEvents[cmdKey + '+' + gitterKey + '+' + n] = 'room.' + n;
  });
  keyEvents[cmdKey + '+' + gitterKey + '+0'] = 'room.10';

  // Add listeners

  var assign = function(k, name, scope) {
    if (_.isObject(name)) {
      scope = name.scope;
      name = name.name;
    }
    scope = scope || 'all';

    var _assign = function(s) {
      key(k, s, function(event, handler) {
        appEvents.trigger('keyboard.' + name, event, handler);
        appEvents.trigger('keyboard.all', name, event, handler);
      });
    };

    if (_.isArray(scope)) { // multiple scopes
      _.each(scope, _assign);
    }
    else {
      _assign(scope);
    }
  };

  _.each(keyEvents, function(name, k) {
    if (_.isArray(name)) { // multiple mappings
      _.each(name, function(n) {
        assign(k, n);
      });
    }
    else {
      assign(k, name);
    }
  });

});
