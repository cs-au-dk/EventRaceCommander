var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('limitations/eval/index.html', 'Eval test', function() {
    browser.driver.sleep(5000);

    var log = element(by.id('log'));
    expect(log.getText()).toEqual('LOADED 1\nLOADED 2\nLOADED 3\nLOADED 4');
});
