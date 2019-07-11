'use strict';

var _ = require('lodash');

var CommunityCreateStepViewModel = require('../community-create-step-view-model');

var CommunityCreateGitHubProjectsStepViewModel = CommunityCreateStepViewModel.extend({
  defaults: _.extend({}, CommunityCreateStepViewModel.prototype.defaults, {
    isOrgAreaActive: true,
    isRepoAreaActive: false,
    repoFilter: null,

    selectedOrgId: null,
    selectedOrgName: null,

    selectedRepoId: null,
    selectedRepoName: null
  })
});

module.exports = CommunityCreateGitHubProjectsStepViewModel;
