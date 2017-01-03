var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('bugs-caused-by-async-calls/fig-4/index.html', 'Click dynamic element test', function() {
    element(by.id('a1')).click();

    browser.driver.sleep(2000);

    element(by.id('a2')).click();
    element(by.css('img.thumb:first-child')).click();

    browser.driver.sleep(2000);

    var log = element(by.id('log'));
    expect(log.getText()).toEqual('');
});
