var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('tests/block-input-default-value/index.html', 'Input default value block test', function () {
    var i = element(by.id('i'));

    expect(i.getAttribute('value')).toEqual('');

    i.click();
    
    element(by.css('body')).getAttribute('class').then(function (classes) {
        expect(classes.indexOf('blocking') >= 0).toEqual(true);
    });

    // Default has been prevented
    expect(i.getAttribute('value')).toEqual('');

    // TODO: Assert that the default text gets inserted

    browser.driver.sleep(3000);

    // Once the default text has been inserted, the postponed focus event is dispatched,
    // which will empty the input field
    expect(i.getAttribute('value')).toEqual('');

    i.sendKeys('abc');

    // The insertion of abc is now allowed
    expect(i.getAttribute('value')).toEqual('abc');
});
