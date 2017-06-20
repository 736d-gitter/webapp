/* jshint unused:strict, browser:true, strict:true */
/* global define:false */
define([
  'jquery',
  'backbone',
  'utils/appevents',
  'views/popover',
  'hbs!./tmpl/commitPopover',
  'hbs!./tmpl/commitPopoverTitle',
  'hbs!./tmpl/commitPopoverFooter'
], function($, Backbone, appEvents, Popover, template, titleTemplate, footerTemplate) {
  "use strict";

  var MAX_PATH_LENGTH = 40;

  var BodyView = Backbone.View.extend({
    className: 'commit-popover-body',
    initialize: function() {
      this.listenTo(this.model, 'change', this.render);
    },
    render: function() {
      var data = this.model.toJSON();

      if(data.author) {

        data.date = moment(data.commit.author.date).format("LLL");

        data.files.forEach(function(file) {
          if(file.filename.length > MAX_PATH_LENGTH) {
            file.fullFilename = file.filename;
            file.filename = getShortPath(file.filename);
          }
        });

        if(data.files.length === 1) {
          data.isFileLengthSingular = true;
          if(data.files[0].patch_html) {
            data.firstPatchHtml = data.files[0].patch_html;
          }
        }

        if(data.stats.additions === 1) {
          data.isAdditionsSingular = true;
        }

        if(data.stats.deletions === 1) {
          data.isDeletionsSingular = true;
        }
      }

      this.$el.html(template(data));
      return this;
    }
  });

  var TitleView = Backbone.View.extend({
    initialize: function() {
      this.listenTo(this.model, 'change', this.render);
    },
    render: function() {
      var data = this.model.toJSON();
      data.shortSha = data.sha.substring(0,7);
      this.$el.html(titleTemplate(data));
      return this;
    }
  });

  var FooterView = Backbone.View.extend({
    className: 'commit-popover-footer',
    initialize: function() {
      this.listenTo(this.model, 'change', this.render);
    },
    events: {
      'click button.mention': 'onMentionClick'
    },
    render: function() {
      this.$el.html(footerTemplate(this.model.toJSON()));
      return this;
    },
    onMentionClick: function() {
      var mentionText = this.model.get('repo')+'@'+this.model.get('sha').substring(0,7);
      appEvents.trigger('input.append', mentionText);
      this.parentPopover.hide();
    }
  });

  function getShortPath(pathString) {
    // if you have one long filename
    if(pathString.split('/').length === 1) {
      return pathString.substring(0, MAX_PATH_LENGTH-1)+'…';
    }

    var shortPath = pathString;

    // remove parents until short enough: a/b/c/d.ext -> …/c/d.ext
    while(shortPath.length > MAX_PATH_LENGTH-2) {
      var parts = shortPath.split('/');
      // cant remove any more parents
      if(parts.length === 1) {
        parts[0] = parts[0].substring(0, MAX_PATH_LENGTH-3)+'…';
      } else {
        parts.shift();
      }
      shortPath = parts.join('/');
    }
    return '…/'+shortPath;
  }

  function createPopover(model, targetElement) {
    return new Popover({
      titleView: new TitleView({model: model}),
      view: new BodyView({model: model}),
      footerView: new FooterView({model: model}),
      targetElement: targetElement,
      placement: 'horizontal'
    });
  }

  var decorator = {

    decorate: function(view) {
      view.$el.find('*[data-link-type="commit"]').each(function(){

        function showPopover(e) {
          var url = '/api/private/gh/repos/'+repo+'/commits/'+sha+'?renderPatchIfSingle=true';
          $.get(url, function(commit) {
            model.set(commit);
          }).fail(function(err) {
            model.set('error', err.status);
          });

          var popover = createPopover(model, e.target);
          popover.show();
          Popover.singleton(view, popover);
        }

        function showPopoverLater(e) {
          var url = '/api/private/gh/repos/'+repo+'/commits/'+sha+'?renderPatchIfSingle=true';
          $.get(url, function(commit) {
            model.set(commit);
          }).fail(function(err) {
            model.set('error', err.status);
          });

          Popover.hoverTimeout(e, function() {
            var popover = createPopover(model, e.target);
            popover.show();
            Popover.singleton(view, popover);
          });
        }

        var $commit = $(this);
        var repo = $commit.data('commitRepo');
        var sha = $commit.data('commitSha');

        if(!repo || !sha) return;

        var model = new Backbone.Model({
          repo: repo,
          sha: sha,
          html_url: 'https://github.com/'+repo+'/commit/'+sha
        });

        $commit.on('click', showPopover);
        $commit.on('mouseover', showPopoverLater);

        view.addCleanup(function() {
          $commit.off('click', showPopover);
          $commit.off('mouseover', showPopoverLater);
        });

      });
    }
  };

  return decorator;

});
