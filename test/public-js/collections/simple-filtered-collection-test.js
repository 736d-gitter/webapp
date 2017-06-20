'use strict';

var assert = require('assert');
var Backbone = require('backbone');
var SimpleFilteredCollection = require('../../../public/js/collections/simple-filtered-collection');

describe('SimpleFilteredCollection', function() {

  var baseCollection;
  var filteredCollection;
  var events;

  beforeEach(function() {
    events = [];
    baseCollection = new Backbone.Collection([]);
    filteredCollection = new SimpleFilteredCollection([], {
      collection: baseCollection,
      filter: function(model) {
        return model.get('i') % 2 === 0;
      }
    });

    filteredCollection.on('add', function(model) {
      events.push({ type: 'add', i: model.get('i') });
    });

    filteredCollection.on('remove', function(model) {
      events.push({ type: 'remove', i: model.get('i') });
    });

    filteredCollection.on('reset', function() {
      events.push({ type: 'reset' });
    });

    filteredCollection.on('change', function(model) {
      events.push({ type: 'change', i: model.get('i'), prevI: model.previous('i') });
    });

  });

  it('should handle an empty collection', function() {
    assert.strictEqual(filteredCollection.length, 0);
    assert.deepEqual(events, []);
  });

  it('should handle adds that match', function() {
    baseCollection.add({ i: 0 });
    assert.strictEqual(filteredCollection.length, 1);
    assert.deepEqual(events, [
      { type: 'add', i: 0 }
    ]);
  });

  it('should handle adds that do not match match', function() {
    baseCollection.add({ i: 1 })
    assert.strictEqual(filteredCollection.length, 0);
    assert.deepEqual(events, []);
  });

  it('should handle items being changed from a match to not a match', function() {
    var model = new Backbone.Model({ i: 1 })
    baseCollection.add(model);
    assert.strictEqual(filteredCollection.length, 0);
    events = [];

    model.set({ i: 2 });
    assert.strictEqual(filteredCollection.length, 1);
    assert.deepEqual(events, [
      { type: 'add', i: 2 }
    ]);
  });

  it('should handle items being changed from a non-match to a match', function() {
    var model = new Backbone.Model({ i: 2 })
    baseCollection.add(model);
    assert.strictEqual(filteredCollection.length, 1);
    events = [];

    model.set({ i: 1 });
    assert.strictEqual(filteredCollection.length, 0);
    assert.deepEqual(events, [
      { type: 'remove', i: 1 }
    ]);
  });

  it('should handle resets', function() {
    baseCollection.add({ i: 0 });
    assert.strictEqual(filteredCollection.length, 1);
    events = [];

    baseCollection.reset();
    assert.strictEqual(filteredCollection.length, 0);

    assert.deepEqual(events, [
      { type: 'reset' }
    ]);
  })

  it('should handle populated resets', function() {
    baseCollection.add({ i: 0 });
    assert.strictEqual(filteredCollection.length, 1);
    events = [];

    baseCollection.reset([{ i: 0 }, { i: 1 }, { i: 2 }]);
    assert.strictEqual(filteredCollection.length, 2);
    assert.deepEqual(events, [
      { type: 'reset' }
    ]);
  });

  it('should handle filter changes ', function() {
    baseCollection.add({ i: 0 });
    baseCollection.add({ i: 1 });
    baseCollection.add({ i: 2 });
    baseCollection.add({ i: 3 });
    baseCollection.add({ i: 4 });
    baseCollection.add({ i: 5 });
    baseCollection.add({ i: 6 });

    assert.strictEqual(filteredCollection.length, 4);
    events = [];

    filteredCollection.setFilter(function() {
      return false;
    });

    assert.strictEqual(filteredCollection.length, 0);

    assert.deepEqual(events, [
      { type: 'remove', i: 6 },
      { type: 'remove', i: 4 },
      { type: 'remove', i: 2 },
      { type: 'remove', i: 0 }
    ]);

    events = [];

    filteredCollection.setFilter(function() {
      return true;
    });

    assert.strictEqual(filteredCollection.length, 7);

    assert.deepEqual(events, [
      { type: 'add', i: 0 },
      { type: 'add', i: 1 },
      { type: 'add', i: 2 },
      { type: 'add', i: 3 },
      { type: 'add', i: 4 },
      { type: 'add', i: 5 },
      { type: 'add', i: 6 },
    ]);
  })

  it('should handle partial filter changes ', function() {
    baseCollection.add({ i: 0 });
    baseCollection.add({ i: 1 });
    baseCollection.add({ i: 2 });
    baseCollection.add({ i: 3 });
    baseCollection.add({ i: 4 });
    baseCollection.add({ i: 5 });
    baseCollection.add({ i: 6 });

    assert.strictEqual(filteredCollection.length, 4);
    events = [];

    filteredCollection.setFilter(function(model) {
      return model.get('i') % 3 === 0;
    });

    assert.strictEqual(filteredCollection.length, 3);

    assert.deepEqual(events, [
      { type: 'remove', i: 4 },
      { type: 'remove', i: 2 },
      { type: 'add', i: 3 },
    ]);
  })

});
