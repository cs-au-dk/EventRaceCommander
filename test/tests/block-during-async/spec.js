var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('tests/block-during-async/index.html', 'Block during async test', function () {
    element(by.id('b')).click();

    browser.driver.sleep(4000);

    element(by.id('a')).click();
    element(by.id('b')).click();

    testing.waitForText('#log', 'REQUEST 1\nEXTERNAL\nDOMContentLoaded\nRESPONSE 1\nREQUEST 2\nRESPONSE 2\nMOUSEDOWN\nMOUSEUP\nCLICK\nREQUEST 3\nRESPONSE 3\nMOUSEDOWN\nMOUSEUP\nCLICK', 5000);
});
