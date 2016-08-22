import assert from 'assert';
import React from 'react';
import { shallow } from 'enzyme';
import sinon from 'sinon';
import CategoryList from '../../../../../../shared/containers/components/forum/category-list.jsx';
import categories from '../../../../../mocks/data/categories';

describe('<CategoryList />', function(){

  let wrapper;
  let clickHandle;
  beforeEach(function(){
    clickHandle = sinon.spy();
    wrapper = shallow(<CategoryList onCategoryClicked={clickHandle} categories={categories} groupName="gitterHQ" />);
  });

  it('should render a single container', function(){
    assert.equal(wrapper.find('Container').length, 1);
  });

  it('should render a container with custom class', () => {
    assert.equal(wrapper.find('.container--category').length, 1);
  });

  it('should render a single panel', function(){
    assert.equal(wrapper.find('Panel').length, 1);
  });

  it('should render a single ui', function(){
    assert.equal(wrapper.find('ul').length, 1);
  });

  it('should render a li for each child', function(){
    assert.equal(wrapper.find('li').length, categories.length);
  });

  it('should render a CategoryListItem for each category', function(){
    assert.equal(wrapper.find('CategoryListItem').length, categories.length);
  });

  it('should call the onCategoryClicked when a child button is clicked', function(){
    wrapper.find('CategoryListItem').at(0).simulate('click');
    assert.equal(clickHandle.callCount, 1);
  });

  it('should call clickHandle with the correct arguments', function(){
    wrapper.find('CategoryListItem').at(0).simulate('click');
    assert(clickHandle.calledWith('all'));
  });

});
