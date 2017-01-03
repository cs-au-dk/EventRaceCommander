var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('tests/timeout/index.html', 'Script request event test', function () {
    browser.driver.sleep(4000);

    // Just to test that we can actually control timeout ordering, although this is dangerous from a semantic perspective
    expect(element(by.id('log')).getText()).toEqual('TIMEOUT_REQUEST 1\nTIMEOUT_REQUEST 2\nTIMEOUT_REQUEST 3\nTIMEOUT_RESPONSE 2\nTIMEOUT_RESPONSE 3');
});
