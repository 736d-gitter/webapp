/*jslint node:true, unused:true*/
/*global describe:true, it:true */
"use strict";

var assert = require('assert');
var tagger = require('../../../server/utils/user-agent-tagger');

describe('user agent tags', function() {

  it('should parse gitter beta ios app', function() {
    var tags = tagger('Mozilla/5.0 (iPhone; CPU iPhone OS 7_1 like Mac OS X) AppleWebKit/537.51.2 (KHTML, like Gecko) Mobile/11D167 GitterBeta/1.2.1 (4659610624)');

    assert.equal(tags['agent:type'], 'mobile');
    assert.equal(tags['agent:family'], 'GitterBeta');
    assert.equal(tags['agent:version'], '1.2.1');
    assert.equal(tags['agent:device:family'], 'iPhone');
    assert.equal(tags['agent:device:version'], undefined);
    assert.equal(tags['agent:os:family'], 'iOS');
    assert.equal(tags['agent:os:version'], '7.1');
  });

  it('should map the gitter ios app version without buildnumber/versionnumber fix', function() {
    var tags = tagger('Mozilla/5.0 (iPhone; CPU iPhone OS 7_1 like Mac OS X) AppleWebKit/537.51.2 (KHTML, like Gecko) Mobile/11D167 Gitter/598 (5736412944)');

    assert.equal(tags['agent:version'], '1.1.1');
  });

  it('shouldnt mess with unmodified Chrome', function() {
    var tags = tagger('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.153 Safari/537.36');

    assert.equal(tags['agent:type'], 'desktop');
    assert.equal(tags['agent:family'], 'Chrome');
    assert.equal(tags['agent:version'], '35.0.1916');
    assert.equal(tags['agent:device:family'], 'Other');
    assert.equal(tags['agent:device:version'], undefined);
    assert.equal(tags['agent:os:family'], 'Mac OS X');
    assert.equal(tags['agent:os:version'], '10.9.3');
  });

  it('shouldnt define any tags if the user agent is null', function() {
    var tags = tagger(null);

    assert.equal(tags['agent:type'], undefined);
    assert.equal(tags['agent:family'], undefined);
    assert.equal(tags['agent:version'], undefined);
    assert.equal(tags['agent:device:family'], undefined);
    assert.equal(tags['agent:device:version'], undefined);
    assert.equal(tags['agent:os:family'], undefined);
    assert.equal(tags['agent:os:version'], undefined);
  });

});
