/*jslint node:true, unused:true*/
/*global describe:true, it:true */

'use strict';

var assert = require('assert');

jest.mock('../../utils/appevents');
const appEvents = require('../../utils/appevents');
appEvents.on.mockImplementation(() => {});

const LoadingView = require('./loading-view');

describe('loading-view', function() {
  it('hides when page is already loaded', function(done) {
    var iframe = {
      contentDocument: {
        readyState: 'complete',
        addEventListener: function() {}
      },
      contentWindow: {
        removeEventListener: function() {},
        addEventListener: function() {}
      },
      addEventListener: function() {}
    };
    var loadingEl = {
      classList: {
        add: function(className) {
          assert(className, 'hide');
          done();
        }
      }
    };

    new LoadingView(iframe, loadingEl);
  });
});
