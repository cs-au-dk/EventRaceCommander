var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('tests/dynamic-script-load-handler/index.html', 'Dynamic script load handler test', function () {
    testing.waitForText('#log', 'LOAD', 3000);
});
