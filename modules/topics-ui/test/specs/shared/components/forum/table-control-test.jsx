"use strict";

import assert from 'assert';
import React from  'react';
import Backbone from 'backbone';
import sinon from 'sinon';
import { shallow, mount } from 'enzyme';
import TableControl from '../../../../../shared/components/forum/table-control.jsx';


var TagCollection = Backbone.Collection.extend({
  getTags(){ return this.models.map((m) => m.toJSON() ); }
});

describe.only('<TableControl/>', () => {

  let wrapper;
  let mounted;
  let tags;
  let filterHandle;

  beforeEach(() => {
    filterHandle = sinon.spy();
    tags = [{value: 'all-tags', name: 'All Tags', active: true }];
    wrapper = shallow(
      <TableControl
      tags={tags}
      groupName="gitterHQ"
      category="all"
      filterChange={filterHandle} />
    );
    mounted = mount(
      <TableControl
      tags={tags}
      groupName="gitterHQ"
      category="all"
      filterChange={filterHandle}/>
    );
  });

  it('should render a container', () => {
    assert.equal(wrapper.find('Container').length, 1);
  });

  it('should render a panel', () => {
    assert.equal(wrapper.find('Panel').length, 1);
  });

  it('should render the panel with a variation class', () => {
    assert.equal(wrapper.find('.panel--table-control').length, 1);
  });

  it('should render the container with a custom class', () => {
    assert.equal(wrapper.find('.container--table-control').length, 1);
  });

  it('should render three table-control-buttons', () => {
    assert.equal(wrapper.find('TableControlButton').length, 3);
  });

  it('should render two select elements', () => {
    assert.equal(wrapper.find('TableControlSelect').length, 2);
  });

  it('should render with the right default props', () => {
    assert.equal(mounted.props().sortBy.length, 4);
  });

  it('should render only one divider', () => {
    assert.equal(wrapper.find('.tabel-control__divider').length, 1);
  });

  it('should call filterChange when a TopicTableButton is pressed', () => {
    wrapper.find('TableControlButton').at(0).prop('onClick')();
    assert.equal(filterHandle.callCount, 1);
  });

  it('should call filterChange with the right arguments', () => {
    wrapper.find('TableControlButton').at(0).prop('onClick')('activity');
    assert(filterHandle.calledWith('activity'));
  });

});
