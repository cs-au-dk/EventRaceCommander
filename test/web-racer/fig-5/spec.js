var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('web-racer/fig-5/index.html', 'WebRacer Fig. 5', function() {
    browser.driver.sleep(3000);

    var o = element(by.id('o'));
    expect(o.getText()).toEqual('Loaded');
});
