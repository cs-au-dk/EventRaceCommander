var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('tests/block-select-default-value/index.html', 'Select default value block test', function () {
    var s = element(by.id('s'));

    expect(element(by.cssContainingText('option', '1')).isSelected()).toEqual(true);

    s.sendKeys('3');
    
    element(by.css('body')).getAttribute('class').then(function (classes) {
        expect(classes.indexOf('blocking') >= 0).toEqual(true);
    });

    // Default has been prevented
    expect(s.getAttribute('value')).toEqual('1');

    browser.driver.sleep(3000);

    expect(element(by.cssContainingText('option', '5')).isSelected()).toEqual(true);

    s.sendKeys('3');

    expect(element(by.cssContainingText('option', '3')).isSelected()).toEqual(true);
});
