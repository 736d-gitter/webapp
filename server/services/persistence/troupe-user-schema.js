/*jshint globalstrict: true, trailing: false, unused: true, node: true */
"use strict";

var mongoose       = require('../../utils/mongoose-q');
var Schema         = mongoose.Schema;
var ObjectId       = Schema.ObjectId;

module.exports = {
  install: function(mongooseConnection) {

    //
    // User in a Troupe
    //
    var TroupeUserSchema = new Schema({
      troupeId: { type: ObjectId },
      userId: { type: ObjectId },
      lurk: { type: Boolean },
      /** Lurk settings
        *  false, undefined: no lurking
        *  true: lurking
        */
    });
    TroupeUserSchema.schemaTypeName = 'TroupeUserSchema';

    TroupeUserSchema.index({ "troupeId": 1, "userId": 1 }, { unique: true });
    TroupeUserSchema.index({ "troupeId": 1 });
    TroupeUserSchema.index({ "userId": 1 });

    var TroupeUser = mongooseConnection.model('TroupeUser', TroupeUserSchema);

    return {
      model: TroupeUser,
      schema: TroupeUserSchema
    };
  }
};
