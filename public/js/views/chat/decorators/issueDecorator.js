/* jshint unused:strict, browser:true, strict:true */
/* global define:false */
define([
  'jquery',
  'backbone',
  'marionette',
  'underscore',
  'utils/context',
  'utils/appevents',
  'views/popover',
  'hbs!./tmpl/issuePopover',
  'hbs!./tmpl/issuePopoverTitle',
  'hbs!./tmpl/commitPopoverFooter'
], function($, Backbone, Marionette, _, context, appEvents, Popover, bodyTemplate, titleTemplate, footerTemplate) {
  "use strict";

  var BodyView = Marionette.ItemView.extend({
    className: 'issue-popover-body',
    template: bodyTemplate,
    modelEvents: {
      change: 'render'
    },
    serializeData: function() {
      var data = this.model.toJSON();
      data.date = moment(data.created_at).format("LLL");
      return data;
    }
  });

  var TitleView = Marionette.ItemView.extend({
    modelEvents: {
      change: 'render'
    },
    template: titleTemplate
  });

  var FooterView = Marionette.ItemView.extend({
    className: 'commit-popover-footer',
    template: footerTemplate,
    events: {
      'click button.mention': 'onMentionClick'
    },
    modelEvents: {
      change: 'render'
    },
    onMentionClick: function() {
      var roomRepo = getRoomRepo();
      var modelRepo = this.model.get('repo');
      var modelNumber = this.model.get('number');
      var mentionText = (modelRepo === roomRepo) ? '#' + modelNumber : modelRepo + '#' + modelNumber;
      appEvents.trigger('input.append', mentionText);
      this.parentPopover.hide();
    }
  });

  function getRoomRepo() {
    var room = context.troupe();
    if(room.get('githubType') === 'REPO') {
      return room.get('uri');
    } else {
      return '';
    }
  }

  function createPopover(model, targetElement) {
    return new Popover({
      titleView: new TitleView({ model: model }),
      view: new BodyView({ model: model }),
      footerView: new FooterView({ model: model }),
      targetElement: targetElement,
      placement: 'horizontal'
    });
  }

  // Query issues has the form { issue: [callbacks] }
  var queryIssues = {};
  var throttledQuery = _.throttle(function() {
    var workingQueryIssues = queryIssues;
    queryIssues = {};

    var issues = Object.keys(workingQueryIssues);
    if(!issues.length) return;

    // Better chance of caching if sorted
    issues.sort();

    $.ajax({
      url: '/api/private/issue-state',
      data: issues.map(function(r) { return { name: 'q', value: r }; }),
      success: function(states) {
        issues.forEach(function(issue, index) {
          var state = states[index] || '';
          var callbacks = workingQueryIssues[issue];

          callbacks.forEach(function(callback) {
            callback(state);
          });
        });
      }
    });
  }, 100, { leading: false });

  function addIssue(repo, issueNumber, callback) {
    var issue = repo + '/' + issueNumber;

    var callbacks = queryIssues[issue];
    if(!callbacks) {
      callbacks = [callback];
      queryIssues[issue] = callbacks;
    } else {
      callbacks.push(callback);
    }

    throttledQuery();
  }

  var IssueModel = Backbone.Model.extend({
    idAttribute: "number",
    urlRoot: function() {
      var repo = this.get('repo');
      return '/api/private/gh/repos/' + repo + '/issues/';
    }
  });

  var decorator = {

    decorate: function(view) {
      var roomRepo = getRoomRepo();

      view.$el.find('*[data-link-type="issue"]').each(function() {
        var $issue = $(this);

        var repo = $issue.data('issueRepo') || roomRepo;
        var issueNumber = $issue.data('issue');

        addIssue(repo, issueNumber, function(state) {
          // dont change the issue state colouring for the activity feed
          if(!$issue.hasClass('open') && !$issue.hasClass('closed')) {
            $issue.addClass(state);
          }
        });

        function getModel() {
          var model = new IssueModel({
            repo: repo,
            number: issueNumber,
            html_url: 'https://github.com/' + repo + '/issues/' + issueNumber
          });

          model.fetch({
            data: { renderMarkdown: true },
            error: function() {
              model.set({ error: true });
            }
          });
          return model;
        }
        function showPopover(e, model) {
          if(!model) model = getModel();

          var popover = createPopover(model, e.target);
          popover.show();
          Popover.singleton(view, popover);
        }

        function showPopoverLater(e) {
          var model = getModel();

          Popover.hoverTimeout(e, function() {
            showPopover(e, model);
          });
        }

        $issue.on('click', showPopover);
        $issue.on('mouseover', showPopoverLater);

        view.addCleanup(function() {
          $issue.off('click', showPopover);
          $issue.off('mouseover', showPopoverLater);
        });
      });
    }
  };

  return decorator;

});
