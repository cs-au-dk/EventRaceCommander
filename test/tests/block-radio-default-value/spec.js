var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('tests/block-radio-default-value/index.html', 'Radio default value block test', function () {
    var r1 = element(by.id('r1'));
    var r2 = element(by.id('r2'));

    expect(r1.isSelected()).toEqual(false);
    expect(r2.isSelected()).toEqual(false);

    r2.click();

    expect(r1.isSelected()).toEqual(false);
    expect(r2.isSelected()).toEqual(false);

    browser.driver.sleep(2000);

    expect(r1.isSelected()).toEqual(true);
    expect(r2.isSelected()).toEqual(false);

    r2.click();

    expect(r1.isSelected()).toEqual(false);
    expect(r2.isSelected()).toEqual(true);
});
