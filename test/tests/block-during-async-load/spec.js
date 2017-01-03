var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('tests/block-during-async-load/index.html', 'Block during async load test', function () {
    element(by.id('b')).click();

    browser.driver.sleep(4000);

    element(by.id('a')).click();
    element(by.id('b')).click();

    testing.waitForText('#log', 'REQUEST 1\nEXTERNAL\nDOMContentLoaded\nRESPONSE 1\nREQUEST 2\nRESPONSE 2\nCLICK\nREQUEST 3\nCLICK\nRESPONSE 3', 5000);

    // Check that the policy is fully resolved now that the page has finished loading
    expect(browser.executeScript('return $_C.isDisabled();')).toEqual(true);
});
