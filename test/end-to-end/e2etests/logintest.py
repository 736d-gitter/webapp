
from selenium.webdriver.common.action_chains import ActionChains
import utils

driver = None


def setup_module():
    global driver
    driver = utils.driver()


def testSignInAndSignout():
    utils.existingUserlogin(driver, 'testuser@troupetest.local', '123456')
    driver.find_element_by_css_selector('DIV.trpHeaderTitle')

    profile = driver.find_element_by_css_selector('DIV.trpProfileButton DIV.trpDisplayPicture')

    chain = ActionChains(driver)
    chain.move_to_element(profile)

    signOut = driver.find_element_by_id('link-signout')
    signOut.click()

    driver.find_element_by_css_selector('DIV.trpHomeHeroStripContainer')


def testSignInAndNavigateBack():
    driver.delete_all_cookies()

    utils.existingUserlogin(driver, 'testuser@troupetest.local', '123456')
    driver.find_element_by_css_selector('DIV.trpHeaderTitle')

    driver.get(utils.baseUrl("x"))
    driver.find_element_by_css_selector('DIV.trpHeaderTitle')


def teardown_module():
    utils.screenshot(driver)
    driver.quit()
