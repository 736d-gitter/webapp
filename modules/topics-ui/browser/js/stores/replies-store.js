import Backbone from 'backbone';
import LiveCollection from './live-collection';
import {BaseModel} from './base-model';
import {subscribe} from '../../../shared/dispatcher';

import router from '../routers';
import {getCurrentUser} from './current-user-store';
import {getForumId} from './forum-store'
import {getRealtimeClient} from './realtime-client';

import parseReply from '../../../shared/parse/reply';
import dispatchOnChangeMixin from './mixins/dispatch-on-change';

import {MODEL_STATE_DRAFT} from '../../../shared/constants/model-states';
import {NAVIGATE_TO_TOPIC} from '../../../shared/constants/navigation';
import {SUBMIT_NEW_REPLY} from '../../../shared/constants/create-reply';
import {UPDATE_REPLY, CANCEL_UPDATE_REPLY, SAVE_UPDATE_REPLY} from '../../../shared/constants/topic';
import {
  UPDATE_REPLY_SUBSCRIPTION_STATE,
  REQUEST_UPDATE_REPLY_SUBSCRIPTION_STATE,
  SUBSCRIPTION_STATE_PENDING
} from '../../../shared/constants/forum.js';

export const ReplyModel = BaseModel.extend({
  // Why doesn't this just come from it's owner collection?
  url() {
    return this.get('id') ?
    `/v1/forums/${getForumId()}/topics/${router.get('topicId')}/replies/${this.get('id')}`:
    `/v1/forums/${getForumId()}/topics/${router.get('topicId')}/replies`;
  },
});

export const RepliesStore = LiveCollection.extend({

  model: ReplyModel,
  client: getRealtimeClient(),
  urlTemplate: '/v1/forums/:forumId/topics/:topicId/replies',

  getContextModel(){
    return new Backbone.Model({
      forumId: getForumId(),
      topicId: router.get('topicId'),
    });
  },

  initialize(){
    subscribe(SUBMIT_NEW_REPLY, this.createNewReply, this);
    subscribe(NAVIGATE_TO_TOPIC, this.onNavigateToTopic, this);
    subscribe(UPDATE_REPLY, this.updateReplyText, this);
    subscribe(CANCEL_UPDATE_REPLY, this.cancelEditReply, this);
    subscribe(SAVE_UPDATE_REPLY, this.saveUpdatedModel, this);
    subscribe(REQUEST_UPDATE_REPLY_SUBSCRIPTION_STATE, this.onRequestSubscriptionStateUpdate, this);
    subscribe(UPDATE_REPLY_SUBSCRIPTION_STATE, this.onSubscriptionStateUpdate, this);
    router.on('change:topicId', this.onActiveTopicUpdate, this);
  },

  getById(id) {
    const model = this.get(id);
    if(!model) { return; }
    return parseReply(model.toPOJO());
  },

  getReplies(){
    return this.models.map(model => {
      return parseReply(model.toPOJO());
    });
  },

  createNewReply(data){
    this.create({
      text: data.body,
      user: getCurrentUser(),
      sent: new Date().toISOString(),
      state: MODEL_STATE_DRAFT
    });
  },

  onActiveTopicUpdate(router, topicId){
    this.contextModel.set('topicId', topicId);
  },

  onNavigateToTopic(){
    this.reset([]);
  },

  updateReplyText({replyId, text}) {
    const model = this.get(replyId);
    if(!model) { return; }
    model.set('text', text);
  },

  cancelEditReply({replyId}) {
    const model = this.get(replyId);
    if(!model) { return; }
    model.set('text', null);
  },

  saveUpdatedModel({replyId}){
    const model = this.get(replyId);
    if(!model) { return; }
    model.save({ text: model.get('text') }, { patch: true });
  },

  onRequestSubscriptionStateUpdate({replyId}) {
    var reply = this.get(replyId);
    if(!reply) { return; }

    reply.set({
      subscriptionState: SUBSCRIPTION_STATE_PENDING
    });
  },

  onSubscriptionStateUpdate(data) {
    var {replyId, state} = data;
    var reply = this.get(replyId);
    if(!reply) { return; }

    reply.set({
      subscriptionState: state
    });
  }

});

dispatchOnChangeMixin(RepliesStore, [
  'change:subscriptionState',
  'change:text',
  'change:body'
]);

const serverStore = (window.context.repliesStore|| {});
const serverData = (serverStore.data || [])
let store;

export function getRepliesStore(data){
  if(!store){ store = new RepliesStore(serverData); }
  if(data) { store.set(data); }
  return store;
}
