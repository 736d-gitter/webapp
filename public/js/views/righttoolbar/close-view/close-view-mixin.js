'use strict';

var _ = require('lodash');

var defaults = {
  pinStateClass: 'is-menu-pinned',
  extraMouseOverElement: null,
  width: 30,
  height: 24,
  deflection: 5,
  strokeWidth: 2
};

var legDefaults = _.extend({}, defaults, {
  offsetY: 0
});

// `t` is a value from 0 to 1 representing the amount of deflection
// `dir` is the direction the arrow is pointing
var getDeflectedLegDescription = function(options, dir, t) {
  var opts = _.extend({}, legDefaults, options);
  var actualDeflection = t * opts.deflection;

  var pathDescription =
    'M0,' +
    opts.offsetY +
    ' l' +
    opts.width / 2 +
    ',' +
    -1 * dir * actualDeflection +
    ' l' +
    opts.width / 2 +
    ',' +
    dir * actualDeflection;

  return pathDescription;
};

// `t` is a value from 0 to 1 representing the amount of deflection
var getFirstLegDescription = function(options, t) {
  var opts = _.extend({}, legDefaults, options);
  var newOpts = _.extend({}, opts, {
    offsetY: opts.offsetY + (opts.deflection + opts.strokeWidth / 2)
  });
  var pathDescription = getDeflectedLegDescription(newOpts, 1, t);

  return pathDescription;
};

var getSecondLegDescription = function(options) {
  var opts = _.extend({}, legDefaults, options);
  var pathDescription =
    'M0,' +
    (opts.height / 2 + opts.deflection) +
    ' l' +
    opts.width / 2 +
    ',0' +
    ' l' +
    opts.width / 2 +
    ',0';
  return pathDescription;
};

var getThirdLegDescription = function(options, t) {
  var opts = _.extend({}, legDefaults, options);
  var newOpts = _.extend({}, opts, {
    offsetY: opts.offsetY + (opts.height + opts.deflection - opts.strokeWidth / 2)
  });
  var pathDescription = getDeflectedLegDescription(newOpts, -1, t);

  return pathDescription;
};

// Animation/Interaction
// ------------------------------------------
var getLegDeflectAnimationOptions = function() {
  var opts = this.iconOpts;
  var legElements = this.ui.toggleIcon[0].children;
  // We are probably in IE which makes it hard to work with SVG's
  if (!legElements) {
    // Filter out the text nodes
    legElements = Array.prototype.filter.call(this.ui.toggleIcon[0].childNodes || [], function(
      node
    ) {
      // Magic number 3 for the text node type
      return node.nodeType !== 3;
    });
  }

  return {
    duration: 200,
    queue: false,
    step: function(t, fx) {
      if (legElements && legElements.length >= 3) {
        if (fx.prop === 'firstT') {
          legElements[0].setAttribute('d', getFirstLegDescription(opts, fx.now));
        } else if (fx.prop === 'thirdT') {
          legElements[2].setAttribute('d', getThirdLegDescription(opts, fx.now));
        }
      }
    }
  };
};

var deflectArms = function() {
  var isPinned = this.getPinnedState();
  var isHovered = this.iconHover;

  var legDeflectAnimationOptions = this.getLegDeflectAnimationOptions();
  if (isHovered && isPinned) {
    this.ui.toggleIcon.animate(
      {
        firstT: 0,
        thirdT: 1
      },
      legDeflectAnimationOptions
    );
  } else if (isHovered) {
    this.ui.toggleIcon.animate(
      {
        firstT: 1,
        thirdT: 0
      },
      legDeflectAnimationOptions
    );
  } else {
    this.ui.toggleIcon.animate(
      {
        firstT: 0,
        thirdT: 0
      },
      legDeflectAnimationOptions
    );
  }
};

var setupCloseIcon = function() {
  var toggleIconElement = this.ui.toggleIcon[0];

  var totalHeight = this.iconOpts.height + 2 * this.iconOpts.deflection;
  toggleIconElement.setAttribute('width', this.iconOpts.width + 'px');
  toggleIconElement.setAttribute('height', totalHeight + 'px');
  toggleIconElement.setAttribute('viewBox', '0 0 ' + this.iconOpts.width + ' ' + totalHeight);

  var legElements = toggleIconElement.children;
  if (legElements && legElements.length >= 3) {
    legElements[0].setAttribute('d', getFirstLegDescription(this.iconOpts, 0));
    legElements[1].setAttribute('d', getSecondLegDescription(this.iconOpts, 0));
    legElements[2].setAttribute('d', getThirdLegDescription(this.iconOpts, 0));
  }

  this.updatePinnedState();
};

module.exports = {
  defaults: defaults,
  getFirstLegDescription: getFirstLegDescription,
  getSecondLegDescription: getSecondLegDescription,
  getThirdLegDescription: getThirdLegDescription,
  getLegDeflectAnimationOptions: getLegDeflectAnimationOptions,
  deflectArms: deflectArms,
  setupCloseIcon: setupCloseIcon
};
