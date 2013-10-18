/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var i18n = require('i18n');

// TODO: put this somewhere else
i18n.configure({
    // setup some locales - other locales default to en silently
    locales:['en'],

    // you may alter a site wide default locale
    defaultLocale: 'en',

    // // sets a custom cookie name to parse locale settings from  - defaults to NULL
    // cookie: 'yourcookiename',

    // where to store json files - defaults to './locales' relative to modules directory
    directory: __dirname + '/../../public/locales',

    // whether to write new locale information to disk - defaults to true
    updateFiles: true
});


module.exports=i18n;