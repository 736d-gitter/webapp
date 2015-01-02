/*jslint node:true, unused:true*/
/*global describe:true, it:true */
'use strict';

var isValidRoomUri = require('../../../public/js/utils/valid-room-uri');
var RESERVED = require('../../../public/js/utils/vanity-keywords');
var assert = require('assert');

function test(name, result) {
  result = typeof result !== 'undefined' ? result : true;
  assert.equal(isValidRoomUri(name), result);
}

describe('valid-room-uri', function () {

  it('rejects vanity keywords', function () {
    RESERVED
      .forEach(function (keyword) {
        test('/' + keyword, false);
      });
  });

  it('accepts rooms with vanity keywords, but aren\'t vanity keyworkds', function () {
    test('/aboutandrew');
    test('/apiguy');
    test('/aboutandrew?test=true');
    test('/apiguy?test=true');
  });

  it('rejects undefined and empty string', function () {
    test('     ', false);
    test(null, false);
    test(undefined, false);
    test('', false);
    test('a', false);
  });

  it('rejects archive links', function () {
    test('/gitterHQ/gitter/archives/all', false);
    test('/gitterHQ/gitter/archives/2014/12/11', false);
    test('/gitterHQ/gitter/archives/all?test=true', false);
    test('/gitterHQ/gitter/archives/2014/12/11?test=true', false);
  });

  it('accepts room URIs', function () {
    test('/gitterHQ');
    test('/gitterHQ/gitter');
    test('/gitterHQ/gitter/channel');
    test('/gitterHQ?test=true');
    test('/gitterHQ/gitter?test=true');
    test('/gitterHQ/gitter/channel?test=true');
  });
});