var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('tests/click-dynamic-element/index.html', 'Click dynamic element test', function() {
    element(by.id('a1')).click();

    browser.driver.sleep(2000);

    var o = element(by.id('o'));
    expect(o.getText()).toEqual('c.adamsen@partner.samsung.com');
});
