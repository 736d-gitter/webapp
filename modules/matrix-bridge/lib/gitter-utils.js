'use strict';

const troupeService = require('gitter-web-rooms/lib/troupe-service');
const securityDescriptorUtils = require('gitter-web-permissions/lib/security-descriptor-utils');
const mongoUtils = require('gitter-web-persistence-utils/lib/mongo-utils');
const env = require('gitter-web-env');
const config = env.config;

const gitterRoomAllowList = config.get('matrix:bridge:gitterRoomAllowList');

let allowedRoomMap;
if (gitterRoomAllowList) {
  allowedRoomMap = gitterRoomAllowList.reduce((map, allowedRoomId) => {
    map[allowedRoomId] = true;
    return map;
  }, {});
}

async function isGitterRoomIdAllowedToBridge(gitterRoomId) {
  // Only public rooms can bridge messages
  const gitterRoom = await troupeService.findById(gitterRoomId);
  const isPublic = securityDescriptorUtils.isPublic(gitterRoom);
  if (!isPublic) {
    return false;
  }

  // If no allowlist was configured, then allow any room to bridge (useful to wildcard all testing in dev/beta).
  if (!allowedRoomMap) {
    return true;
  }

  // In production, we limit the rooms that are bridged in our initial testing phase
  // to limit any bad side-effects that may occur.
  const stringifiedRoomId = mongoUtils.serializeObjectId(gitterRoomId);
  return !!allowedRoomMap[stringifiedRoomId];
}

module.exports = {
  isGitterRoomIdAllowedToBridge
};
