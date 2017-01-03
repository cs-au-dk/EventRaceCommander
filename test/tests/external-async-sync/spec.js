var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('tests/external-async-sync/index.html', 'External async sync', function() {
    browser.driver.sleep(2000);

    var o = element(by.id('o'));
    expect(o.getText()).toEqual('Loaded');
});
