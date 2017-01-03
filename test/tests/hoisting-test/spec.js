var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('tests/hoisting-test/index.html', 'Hoisting test', function () {
    testing.waitForText('#log', 'undefined\n1\n1\n2', 2000);
});
