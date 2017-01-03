var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('tests/events-bubbling-capturing/index.html', 'Events bubbling capturing test', function () {
    element(by.id('inner1')).click();

    browser.driver.sleep(2000);

    expect(element(by.id('log')).getText()).toEqual(
        'handler outer-true, this=outer, target=inner1\n' +
        'handler middle-true, this=middle, target=inner1\n' +
        'handler inner1-inline, this=inner1, target=inner1\n' +
        'handler inner1-false, this=inner1, target=inner1\n' +
        'handler inner1-true, this=inner1, target=inner1\n' +
        'handler middle-inline, this=middle, target=inner1\n' +
        'handler middle-false, this=middle, target=inner1\n' +
        'handler outer-inline, this=outer, target=inner1\n' +
        'handler outer-false, this=outer, target=inner1');
});
