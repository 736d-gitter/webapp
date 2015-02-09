'use strict';
var context = require('utils/context');
var log = require('utils/log');

function hasParentFrameSameOrigin() {
  if (window.parent === window) return false; // This is the top window
  try {
    // This should always return true if you can access the parent origin
    return window.location.host == window.parent.location.host;
  } catch(e) {
    // Cross-origin. So No.
    return false;
  }
}

function postMessage(message) {
  try {
    var json = JSON.stringify(message);
    log.debug('post: ', json, context.env('basePath'));
    window.parent.postMessage(json, context.env('basePath'));
  } catch(e) {
    log.info('frame: unable to post message', e);
  }
}

/* Tell the parent frame that we're loaded */
if(hasParentFrameSameOrigin()) {
  postMessage({ type: "chatframe:loaded" });
}

module.exports = {
  hasParentFrameSameOrigin: hasParentFrameSameOrigin,
  postMessage: postMessage
};
