import {ok} from 'assert';
import Store from '../../../../browser/js/stores/access-token-store';

describe('AccessTokenStore', () => {

  let store;
  beforeEach(() => {
    store = new Store();
  });

  it('should have at least one test', () => {
    ok(store);
  });

});
