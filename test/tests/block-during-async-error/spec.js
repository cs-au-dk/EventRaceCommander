var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('tests/block-during-async-error/index.html', 'Block during async error test', function () {
    element(by.id('b')).click();
    element(by.id('b')).click();

    testing.waitForText('#log', 'CLICK\nREQUEST\nERROR\nCLICK\nREQUEST\nERROR', 5000);
});
