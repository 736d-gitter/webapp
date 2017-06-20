/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var marked    = require('marked');
var highlight = require('highlight.js');
var _         = require('underscore');
var util      = require('util');
var url       = require('url');

var options = { gfm: true, tables: true, sanitize: true, breaks: true, linkify: true, skipComments: true };

var lexer = new marked.Lexer(options);

var JAVA =  'java';
var SCRIPT = 'script:';
var scriptUrl = JAVA + SCRIPT;
var dataUrl = 'data:';
var httpUrl = 'http://';
var httpsUrl = 'https://';
var noProtocolUrl = '//';

highlight.configure({classPrefix: ''});

module.exports = exports = function processChat(text) {
  var urls      = [];
  var mentions  = [];
  var issues    = [];
  var paragraphCount = 0;

  function checkForIllegalUrl(href) {
    if(!href) return "";

    href = href.trim();
    var hrefLower = href.toLowerCase();

    if(hrefLower.indexOf(scriptUrl) === 0 || hrefLower.indexOf(dataUrl) === 0) {
      /* Rickroll the script kiddies */
      return "http://goo.gl/a7HIYr";
    }

    if(hrefLower.indexOf(httpUrl) !== 0 && hrefLower.indexOf(httpsUrl) !== 0 && hrefLower.indexOf(noProtocolUrl) !== 0)  {
      return httpUrl + href;
    }

    return href;
  }

  function getGitHubData(href) {
    var urlObj = url.parse(href);

    if(urlObj.hostname === 'github.com') {
      // [ '', 'trevorah', 'test-repo', 'issues', '1' ]
      var pathParts = urlObj.pathname.split('/');
      if(pathParts[3] === 'issues' && pathParts[4]) {
        return {
          type: 'issue',
          repo: pathParts[1]+'/'+pathParts[2],
          number: pathParts[4]
        };
      } else if(pathParts[3] === 'commit' && pathParts[4]) {
        return {
          type: 'commit',
          repo: pathParts[1]+'/'+pathParts[2],
          sha1: pathParts[4]
        };
      }
    }
  }

  var renderer = new marked.Renderer();

  // Highlight code blocks
  renderer.code = function(code) {
    return util.format('<pre><code>%s</code></pre>', highlight.highlightAuto(code).value);
  };

  // Extract urls mentions and issues from paragraphs
  renderer.paragraph = function(text) {
    paragraphCount++;
    return util.format('<p>%s</p>', text);
  };

  renderer.issue = function(repo, issue, text) {
    issues.push({
      number: issue,
      repo: repo ? repo : undefined
    });

    var out = '<a data-link-type="issue" data-issue="' + issue + '"';
    if(repo) {
      out += util.format(' data-issue-repo="%s"', repo);
    }
    out += ' class="issue">' + text + '</a>';
    return out;
  };

  renderer.commit = function(repo, sha1) {
    var text = repo+'@'+sha1.substring(0, 7);
    var href = 'https://github.com/'+repo+'/commit/'+sha1;
    var out = '<a href="' + href + '"' +
              'data-link-type="commit"' +
              'data-commit-sha1="' + sha1 + '"' +
              'data-commit-repo="' + repo + '"' +
              'class="commit">' + text + '</a>';
    return out;
  };

  renderer.link = function(href, title, text) {
    href = checkForIllegalUrl(href);
    var githubData = getGitHubData(href);
    if(githubData) {
      if(githubData.type === 'issue') {
        var issueText = githubData.repo+'#'+githubData.number;
        return renderer.issue(githubData.repo, githubData.number, issueText);
      } else if(githubData.type === 'commit') {
        return renderer.commit(githubData.repo, githubData.sha1);
      }

    } else {
      urls.push({ url: href });
      return util.format('<a href="%s" rel="nofollow" target="_new" class="link">%s</a>', href, text);  
    }
  };

  renderer.image = function(href, title, text) {
    href = checkForIllegalUrl(href);
    urls.push({ url: href });
    return util.format('<img src="%s" alt="%s" rel="nofollow">', href, text);

  };

  renderer.mention = function(href, title, text) {
    var screenName = text.charAt(0) === '@' ? text.substring(1) : text;
    mentions.push({ screenName: screenName });
    return util.format('<span data-link-type="mention" data-screen-name="%s" class="mention">%s</span>', screenName, text);
  };

  renderer.email = function(href, title, text) {
    checkForIllegalUrl(href);

    urls.push({ url: href });
    return util.format('<a href="%s" rel="nofollow">%s</a>', href, text);
  };

  var tokens = lexer.lex(text);

  var parser = new marked.Parser(_.extend({ renderer: renderer }, options));
  var html = parser.parse(tokens);

  if(paragraphCount === 1) {
    html = html.replace(/<\/?p>/g,'');
  }

  return {
    text: text,
    html: html,
    urls: urls,
    mentions: mentions,
    issues: issues
  };
};