import React, { PropTypes } from 'react';
import Container from '../container.jsx';
import TopicsTableHeader from './topics-table-header.jsx';
import TopicsTableBody from './topics-table-body.jsx';

export default React.createClass({

  displayName: 'TopicsTable',
  propTypes: {
    topics: PropTypes.array.isRequired,
    groupUri: PropTypes.string.isRequired
  },

  render(){
    const { topics, groupUri } = this.props;
    return (
      <Container>
        <table className="topics-table">
          <TopicsTableHeader />
          <TopicsTableBody topics={topics} groupUri={groupUri} />
        </table>
      </Container>
    );
  }

});
