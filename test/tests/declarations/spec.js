var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('tests/declarations/index.html', 'Declarations test', function() {
    browser.driver.sleep(4000);

    var log = element(by.id('log'));
    expect(log.getText()).toEqual('b.js\nb.js');
});
