"use strict";

var persistence = require('../../services/persistence-service');

function listFeatures() {
  return persistence.FeatureToggle.find({}, { name: 1, description: 1 })
    .lean()
    .exec()
    .then(function(togglesList) {
      return togglesList.map(function(f) {
        return { name: f.name, description: f.description };
      });
    });
}

module.exports = function(req, res, next) {
  listFeatures()
    .then(function(features) {
      var result = features.map(function(feature) {
        return {
          name: feature.name,
          description: feature.description,
          enabled: req.fflip.has(feature.name)
        };
      });

      res.send(result);
    })
    .catch(next);
};
