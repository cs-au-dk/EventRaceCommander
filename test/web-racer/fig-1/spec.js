var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('web-racer/fig-1/index.html', 'WebRacer Fig. 1', function() {
    browser.driver.sleep(4000);

    testing.waitForText('#log', 'a.js\nb.js\nc.js\nd.js', 4000);
});
