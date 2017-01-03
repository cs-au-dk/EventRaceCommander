var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('races-that-matter/fig-10/index.html', 'Races That Matter Fig. 10', function() {
	testing.waitForText('#log', 'dtCookie = init\ndtCookie = DOMContentLoaded', 2000);
});
