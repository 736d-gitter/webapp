"use strict";

var Q = require('bluebird-q');
var persistence = require('../persistence-service');
var promiseUtils = require('../../utils/promise-utils');

function create(lean) {
  var module = {};

  module.findByIdRequired = function(id, fields) {
    return persistence.Troupe.findById(id, fields, { lean: lean })
      .exec()
      .then(promiseUtils.required);
  };

  module.findByUris = function(uris) {
    return Q.fcall(function() {
      if(!uris || !uris.length) return [];

      var lcUris = uris.map(function(f) { return f.toLowerCase(); });

      return persistence.Troupe
                .where('lcUri').in(lcUris)
                .lean(lean)
                .exec();
    });
  };

  module.findByOwnerUri = function(userOrOrg, fields) {
    var lcUserOrOrg = userOrOrg.toLowerCase();

    var re = new RegExp('^' + lcUserOrOrg + '($|/)');

    return persistence.Troupe.find({ lcUri: re }, fields, { lean: lean })
      .exec();
  };

  return module;

}


module.exports = {
  lean: create(true), // -> lean: true
  full: create(false) // -> lean: false
};
