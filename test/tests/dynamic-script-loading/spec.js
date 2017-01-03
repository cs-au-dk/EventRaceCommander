var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('tests/dynamic-script-loading/index.html', 'Dynamic script loading test', function () {
    browser.driver.sleep(5000);

    expect(element(by.id('log')).getText()).toEqual('a.js\nb.js\nc.js\nd.js\ne.js');
});
