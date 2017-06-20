import utils
import string
import time
from nose.tools import nottest

driver1 = None
driver2 = None


def findUserElement(elements, name):
    for i in range(0, len(elements)):
        title = elements[i].get_attribute('data-original-title')

        if string.find(title, name) >= 0:
            return elements[i]

    print('No match found for ' + name)
    return None


def setup_module():
    global driver1
    global driver2

    driver1 = utils.driver()
    driver2 = utils.secondDriver()


@nottest
def testUsersComingOnlineAndGoingOffline():
    global driver1
    global driver2

    utils.existingUserlogin(driver1, 'testuser@troupetest.local', '123456')
    utils.existingUserlogin(driver2, 'testuser2@troupetest.local', '123456')

    print('Logged into both clients, now navigating to testtroupe1')

    driver1.get(utils.baseUrl("/testtroupe1"))
    driver2.get(utils.baseUrl("/testtroupe1"))

    user1 = driver1.find_element_by_xpath('//*[@id="people-roster"]/div/span/span/span[1]')
    user2 = driver1.find_element_by_xpath('//*[@id="people-roster"]/div/span/span/span[2]')

    assert user1 is not None
    assert user2 is not None

    print('Found both users ok')

    user1Status = driver1.find_element_by_xpath('//*[@id="people-roster"]/div/span/span/span[1]/a/div/span/div')
    user2Status = driver1.find_element_by_xpath('//*[@id="people-roster"]/div/span/span/span[2]/a/div/span/div')

    assert user1Status is not None
    assert user2Status is not None

    assert string.find(user1Status.get_attribute('class'), 'online') >= 0
    assert string.find(user2Status.get_attribute('class'), 'online') >= 0

    print('Both users are online')

    # driver2.quit()
    # driver2 = None

    print('signing out of Firefox browser')
    driver2.get(utils.baseUrl("/signout"))

    time.sleep(0.5)

    print('checking status of user who was in Firefox and should now be offline')
    user2Status = driver1.find_element_by_xpath('//*[@id="people-roster"]/div/span/span/span[2]/a/div/span/div')

    assert string.find(user2Status.get_attribute('class'), 'offline') >= 0


def teardown_module():
    driver1.quit()
    if driver2 is not None:
        driver2.quit()
