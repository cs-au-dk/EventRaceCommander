var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('tests/block-anchor-default-action/index.html', 'Anchor default action block test', function () {
    element(by.id('a1')).click();

    browser.driver.sleep(2000);

    expect(element(by.id('log')).getText()).toEqual('');
});
