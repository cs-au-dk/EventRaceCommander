var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('tests/requirejs/index.html', 'RequireJS test', function() {
    element(by.id('b')).click();

    testing.waitForText('#log', 'CLICK', 5000);

    element(by.id('b')).click();

    testing.waitForText('#log', 'CLICK\nCLICK', 5000);
});
