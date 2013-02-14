/*jshint globalstrict:true, trailing:false unused:true node:true*/
"use strict";

var mongoose = require("mongoose");
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;
var appEvents = require("../app-events");
var _ = require("underscore");
var winston = require("winston");
var nconf = require("../utils/config");

var connection = mongoose.connection;

//mongoose.mongo = require('mongodb');
mongoose.set('debug', nconf.get("mongo:logQueries"));

mongoose.connect(nconf.get("mongo:url"));
if(nconf.get("mongo:profileSlowQueries")) {

  var nativeDb = mongoose.connection.db;
  var profileCollection = nativeDb.collection("system.profile");
  var MAX = 5;

  // Let the rest of the app start first
  setTimeout(function() {
    profileCollection.findOne({}, { sort: [[ "ts",  -1 ]] }, function(err, latest) {
      if(err) winston.debug("Profiling error: ", err);

      var ts = err || !latest ? 0 : latest.ts;

      winston.info("MongoDB profiling enabled");
      connection.setProfiling(1, MAX, function() {});

      setInterval(function() {
        profileCollection.find({ ts: { $gt: ts } }, { sort: { ts: 1 }}).toArray(function(err, items) {
          if(err) return winston.debug("Profiling error: ", err);
          if(items.length === 0)  return;
          items.forEach(function(item) {
            if(item.ts < ts) return;

            if(item.millis > MAX) {
              winston.warn("Mongo operation exceeded max", item);
            }
            if(item.ts > ts) ts = item.ts;

          });

        });
      }, 1000);
    });

  }, 2000);

}

connection.on('error', function(err) {

  winston.info("MongoDB connection error", { exception: err });
  console.error(err);
  if(err.stack) console.log(err.stack);
});

// --------------------------------------------------------------------
// Utility serialization stuff
// --------------------------------------------------------------------

// This needs to be late-bound to prevent circular dependencies
// TODO: review architecture to remove possible circular dependency
var serializeModel = null;
function serializeModelLateBound(model, callback) {
  if(serializeModel === null) {
    serializeModel = require("../serializers/rest-serializer").serializeModel;
  }
  serializeModel(model, callback);
}

function serializeEvent(url, operation, model, callback) {
  winston.debug("Serializing " + operation + " to " + url);

  serializeModelLateBound(model, function(err, serializedModel) {
    if(err) {
      winston.error("Silently failing model event: ", { exception: err, url: url, operation: operation });
    } else {
      appEvents.dataChange2(url, operation, serializedModel);
    }

    if(callback) callback();
  });
}

// --------------------------------------------------------------------
// Schemas
// --------------------------------------------------------------------


var UserSchema = new Schema({
  displayName: { type: String },
  email: { type: String },
  confirmationCode: {type: String },
  status: { type: String, "enum": ['UNCONFIRMED', 'PROFILE_NOT_COMPLETED', 'ACTIVE'], "default": 'UNCONFIRMED'},
  passwordHash: { type: String },
  passwordResetCode: String,
  avatarVersion: { type: Number, "default": 0 },
  gravatarImageUrl: { type: String },
  lastTroupe: ObjectId,
  location: {
    timestamp: Date,
    coordinate: {
      lon: Number,
      lat: Number
    },
    speed: Number,
    altitude: Number,
    named: {
      place: String,
      region: String,
      countryCode: String
    }
  },
  userToken: String // TODO: move to OAuth
});
UserSchema.index({ email: 1 });
UserSchema.schemaTypeName = 'UserSchema';

var UserLocationHistorySchema = new Schema({
  userId: ObjectId,
  timestamp: Date,
  coordinate: {
      lon: Number,
      lat: Number
  },
  speed: Number
});
UserLocationHistorySchema.index({ userId: 1 });
UserLocationHistorySchema.schemaTypeName = 'UserLocationHistorySchema';

//
// User in a Troupe
//
var TroupeUserSchema = new Schema({
  userId: { type: ObjectId }
  // In future: role
});
TroupeUserSchema.schemaTypeName = 'TroupeUserSchema';

//
// A Troupe
//
var TroupeSchema = new Schema({
  name: { type: String },
  uri: { type: String },
  status: { type: String, "enum": ['INACTIVE', 'ACTIVE'], "default": 'INACTIVE'},
  oneToOne: { type: Boolean, "default": false },
  users: [TroupeUserSchema]
});
TroupeSchema.index({ uri: 1 });
TroupeSchema.schemaTypeName = 'TroupeSchema';

TroupeSchema.methods.getUserIds = function() {
  return this.users.map(function(troupeUser) { return troupeUser.userId; });
};

TroupeSchema.methods.containsUserId = function(userId) {
  var user = _.find(this.users, function(troupeUser) {
    return "" + troupeUser.userId == "" + userId;
  });

  return !!user;
};

TroupeSchema.methods.addUserById = function(userId) {
  // TODO: disable this methods for one-to-one troupes
  var troupeUser = new TroupeUser({ userId: userId });
  this.post('save', function(postNext) {
    var url = "/troupes/" + this.id + "/users";
    serializeEvent(url, "create", troupeUser, postNext);
  });

  return this.users.push(troupeUser);
};

TroupeSchema.methods.removeUserById = function(userId) {
  // TODO: disable this methods for one-to-one troupes
  var troupeUser = _.find(this.users, function(troupeUser){ return troupeUser.userId == userId; });
  if(troupeUser) {
    // TODO: unfortunately the TroupeUser middleware remove isn't being called as we may have expected.....
    this.post('save', function(postNext) {
      var url = "/troupes/" + this.id + "/users";
      serializeEvent(url, "remove", troupeUser, postNext);

      // TODO: move this in a remove listener somewhere else in the codebase
      appEvents.userRemovedFromTroupe({ troupeId: this.id, userId: troupeUser.userId });
    });

    troupeUser.remove();
  } else {
    winston.warn("Troupe.removeUserById: User " + userId + " not in troupe " + this.id);
  }
};

//
// An invitation to a person to join a Troupe
//
var InviteSchema = new Schema({
  troupeId: ObjectId,
  displayName: { type: String },
  email: { type: String },
  code: { type: String },
  status: { type: String, "enum": ['UNUSED', 'USED'], "default": 'UNUSED'}
});
InviteSchema.schemaTypeName = 'InviteSchema';

//
// A request by a user to join a Troupe
//
var RequestSchema = new Schema({
  troupeId: ObjectId,
  userId: ObjectId,
  status: { type: String, "enum": ['PENDING', 'ACCEPTED', 'REJECTED'], "default": 'PENDING'}
});
RequestSchema.schemaTypeName = 'RequestSchema';

//
// A single chat
//
var ChatMessageSchema = new Schema({
  fromUserId: ObjectId,
  toTroupeId: ObjectId,  //TODO: rename to troupeId
  text: String,
  sent: { type: Date, "default": Date.now }
});
ChatMessageSchema.index({ toTroupeId: 1, sent: -1 });
ChatMessageSchema.schemaTypeName = 'ChatMessageSchema';

//
// An email attachment
//
var EmailAttachmentSchema = new Schema({
  fileId: ObjectId,
  version: Number
});
EmailAttachmentSchema.schemaTypeName = 'EmailAttachmentSchema';

var EmailSchema = new Schema({
  from: { type: String },
  fromName: { type: String},
  fromUserId: ObjectId,
  troupeId: ObjectId,
  subject: { type : String },
  date: {type: Date },
  preview: {type: String},
  mail: { type: String},
  messageIds: [ String ],
  attachments: [EmailAttachmentSchema]
});
EmailSchema.schemaTypeName = 'EmailSchema';

var ConversationSchema = new Schema({
  troupeId: ObjectId,
  updated: { type: Date, "default": Date.now },
  subject: { type: String },
  emails: [EmailSchema]
});
ConversationSchema.index({ troupeId: 1 });
ConversationSchema.index({ 'emails.messageIds': 1 });
ConversationSchema.schemaTypeName = 'ConversationSchema';


ConversationSchema.methods.pushEmail = function(email) {
  this.post('save', function(postNext) {
    var url = "/troupes/" + this.troupeId + "/conversations/" + this.id;
    serializeEvent(url, "create", email, postNext);
  });

  return this.emails.push(email);
};

ConversationSchema.methods.removeEmail = function(email) {
  // TODO: unfortunately the TroupeUser middleware remove isn't being called as we may have expected.....
  this.post('save', function(postNext) {
    var url = "/troupes/" + this.troupeId + "/conversations/" + this.id;
    serializeEvent(url, "remove", email, postNext);
  });

  email.remove();
};

var FileVersionSchema = new Schema({
  creatorUserId: ObjectId,
  createdDate: { type: Date, "default": Date.now },
  deleted: { type: Boolean, "default": false },
  thumbnailStatus: { type: String, "enum": ['GENERATING', 'GENERATED', 'NO_THUMBNAIL'], "default": 'GENERATED'}, // In future, the default should be GENERATING

  /* In future, this might change, but for the moment, use a URI-type source */
  source: { type: String }
});
FileVersionSchema.schemaTypeName = 'FileVersionSchema';


var FileSchema = new Schema({
  troupeId: ObjectId,
  fileName: {type: String},
  mimeType: { type: String},
  previewMimeType: { type: String},
  versions: [FileVersionSchema]
});
FileSchema.index({ troupeId: 1 });
FileSchema.schemaTypeName = 'FileSchema';


/*
 * OAuth Stuff
 */
var OAuthClientSchema = new Schema({
  name: String,
  clientKey: String,
  clientSecret: String,
  registeredRedirectUri: String,
  canSkipAuthorization: Boolean
});
OAuthClientSchema.index({ clientKey: 1 });
OAuthClientSchema.schemaTypeName = 'OAuthClientSchema';

var OAuthCodeSchema = new Schema({
  code: String,
  clientId: ObjectId,
  redirectUri: String,
  userId: ObjectId
});
OAuthCodeSchema.index({ code: 1 });
OAuthCodeSchema.schemaTypeName = 'OAuthCodeSchema';

var OAuthAccessTokenSchema= new Schema({
  token: String,
  userId: ObjectId,
  clientId: ObjectId
});
OAuthAccessTokenSchema.index({ token: 1 });
OAuthAccessTokenSchema.schemaTypeName = 'OAuthAccessTokenSchema';


/*
 * Reverse Geocoder Stuff
 */
var GeoPopulatedPlaceSchema= new Schema({
  geonameid: String,
  name: String,
  coordinate: {
    lon: Number,
    lat: Number
  },
  region: {
    code: String,
    name: String
  },
  country: {
    code: String,
    name: String
  },
  population: Number,
  timezone: String
});
GeoPopulatedPlaceSchema.index({ coordinate: "2d" });
GeoPopulatedPlaceSchema.index({ geonameid: 1 });
GeoPopulatedPlaceSchema.schemaTypeName = 'GeoPopulatedPlaceSchema';

/*
 * Push Notifications
 */
 var PushNotificationDeviceSchema = new Schema({
  userId: ObjectId,
  deviceId: String,
  deviceName: String,
  appleToken: Buffer,
  deviceType: { type: String, "enum": ['APPLE', 'ANDROID']},
  timestamp: Date
});
PushNotificationDeviceSchema.index({ deviceId: 1 });
PushNotificationDeviceSchema.index({ userId: 1 });
PushNotificationDeviceSchema.schemaTypeName = 'PushNotificationDeviceSchema';


var User = mongoose.model('User', UserSchema);
var UserLocationHistory = mongoose.model('UserLocationHistory', UserLocationHistorySchema);

var Troupe = mongoose.model('Troupe', TroupeSchema);
var TroupeUser = mongoose.model('TroupeUser', TroupeUserSchema);
var Email = mongoose.model('Email', EmailSchema);
var EmailAttachment = mongoose.model('EmailAttachment', EmailAttachmentSchema);
var Conversation = mongoose.model('Conversation', ConversationSchema);
var Invite = mongoose.model('Invite', InviteSchema);
var Request = mongoose.model('Request', RequestSchema);
var ChatMessage = mongoose.model('ChatMessage', ChatMessageSchema);
var File = mongoose.model('File', FileSchema);
var FileVersion = mongoose.model('FileVersion', FileVersionSchema);

var OAuthClient = mongoose.model('OAuthClient', OAuthClientSchema);
var OAuthCode = mongoose.model('OAuthCode', OAuthCodeSchema);
var OAuthAccessToken = mongoose.model('OAuthAccessToken', OAuthAccessTokenSchema);

var GeoPopulatedPlace = mongoose.model('GeoPopulatedPlaces', GeoPopulatedPlaceSchema);

var PushNotificationDevice = mongoose.model('PushNotificationDevice', PushNotificationDeviceSchema);


module.exports = {
  schemas: {
    UserSchema: UserSchema,
    UserLocationHistorySchema: UserLocationHistorySchema,
    TroupeSchema: TroupeSchema,
    TroupeUserSchema: TroupeUserSchema,
    EmailSchema: EmailSchema,
    EmailAttachmentSchema: EmailAttachmentSchema,
    ConversationSchema: ConversationSchema,
    InviteSchema: InviteSchema,
    RequestSchema: RequestSchema,
    ChatMessageSchema: ChatMessageSchema,
    FileSchema: FileSchema,
    FileVersionSchema: FileVersionSchema,
    OAuthClientSchema: OAuthClientSchema,
    OAuthCodeSchema: OAuthCodeSchema,
    OAuthAccessTokenSchema: OAuthAccessTokenSchema,
    GeoPopulatedPlaceSchema: GeoPopulatedPlaceSchema,
    PushNotificationDeviceSchema: PushNotificationDeviceSchema
  },
  User: User,
  Troupe: Troupe,
  TroupeUser: TroupeUser,
	Email: Email,
  EmailAttachment: EmailAttachment,
  Conversation: Conversation,
	Invite: Invite,
  Request: Request,
	ChatMessage: ChatMessage,
  File: File,
  FileVersion: FileVersion,
  OAuthClient: OAuthClient,
  OAuthCode: OAuthCode,
  OAuthAccessToken: OAuthAccessToken,
  GeoPopulatedPlace: GeoPopulatedPlace,
  UserLocationHistory: UserLocationHistory,
  PushNotificationDevice: PushNotificationDevice
};

process.nextTick(function() {
  console.log("Installing mongoose events");
  var events = require("./persistence-service-events");
  events.install(module.exports);
});