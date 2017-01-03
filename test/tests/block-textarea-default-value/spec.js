var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('tests/block-textarea-default-value/index.html', 'Textarea default value block test', function () {
    var t = element(by.id('t'));

    expect(t.getAttribute('value')).toEqual('');

    t.click();
    
    element(by.css('body')).getAttribute('class').then(function (classes) {
        expect(classes.indexOf('blocking') >= 0).toEqual(true);
    });

    // TODO: Assert that the default text gets inserted

    browser.driver.sleep(3000);

    // Once the default text has been inserted, the postponed focus event is dispatched,
    // which will empty the input field
    expect(t.getAttribute('value')).toEqual('');

    t.sendKeys('abc');

    // The insertion of abc is now allowed
    expect(t.getAttribute('value')).toEqual('abc');
});
