var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

var options =  { tolerateList: ['POSTPONING INLINE SCRIPT'] };

testing.test('tests/script-request-event/index.html', 'Script request event test', function () {
    browser.driver.sleep(1000);

    expect(element(by.id('log')).getText()).toEqual('EXTERNAL\nINLINE');
}, options);
