var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('web-racer/fig-3/index.html', 'WebRacer Fig. 3', function() {
    // Checks two things:
    // (i) a1-click action is delayed until the o-field is present, and
    // (ii) user event order is preserved, in particular, the a2-click
    // action is delayed until after the a1-click action).
    element(by.id('a1')).click(); // writes c.adamsen@partner.samsung.com
    element(by.id('a2')).click(); // writes quist@cs.au.dk

    browser.driver.sleep(2000);

    var o = element(by.id('o'));
    expect(o.getText()).toEqual('quist@cs.au.dk');
});
