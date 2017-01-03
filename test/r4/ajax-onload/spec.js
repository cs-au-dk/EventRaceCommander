var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('r4/ajax/index.html', 'R4 AJAX example', function() {
    testing.waitForText('#log', 'LOADED 1\nLOADED 2\nLOADED 3\nLOADED 4', 10000);
});
