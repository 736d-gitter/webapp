'use strict';

var avatarCdnResolver = require('../shared/avatar-cdn-resolver');
var gravatar = require('./gravatar');

function getForGitHubUsername(githubUsername) {
  return avatarCdnResolver('/gh/u/' + githubUsername);
}

function getForGravatarEmail(emailAddress) {
  var hash = gravatar.hashEmail(emailAddress);
  return avatarCdnResolver('/gravatar/m/' + hash);
}

function getForGroupId(groupId) {
  return avatarCdnResolver('/group/i/' + groupId);
}

function getDefault() {
  return 'https://avatars.githubusercontent.com/u/0';
}

module.exports = {
  getForGitHubUsername: getForGitHubUsername,
  getForGravatarEmail: getForGravatarEmail,
  getForGroupId: getForGroupId,
  getDefault: getDefault,
}
