var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('tests/block-checkbox-default-value/index.html', 'Checkbox default value block test', function () {
    var c1 = element(by.id('c1'));

    c1.click();

    expect(c1.isSelected()).toEqual(false);

    browser.driver.sleep(3000);

    expect(c1.isSelected()).toEqual(true);

    c1.click();

    expect(c1.isSelected()).toEqual(false);
});
