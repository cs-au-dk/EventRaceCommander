var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('limitations/img-loading/index.html', 'Img loading test', function () {
    browser.driver.sleep(5000);

    // Just to test that we can actually control timeout ordering, although this is dangerous from a semantic perspective
    expect(element(by.id('log')).getText()).toEqual('a.js\ndocument.DOMContentLoaded\nimg1.load\nimg2.load\nimg3.load');
});
