var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('tests/block-during-async-no-handler/index.html', 'Block during async no handler test', function () {
    element(by.id('b')).click();

    testing.waitForText('#log', 'CLICK', 5000);
});
