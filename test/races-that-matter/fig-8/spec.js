var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

var options =  { tolerateList: ['POSTPONING INLINE SCRIPT'] };

testing.test('races-that-matter/fig-8/index.html', 'Races That Matter Fig. 8', function() {
    browser.driver.sleep(3000);

    element(by.id('b1')).click();
    element(by.id('b2')).click();

    testing.waitForText('#log', '__uv_.x = CLICK A\n__uv_.y = CLICK B', 1000);
}, options);
