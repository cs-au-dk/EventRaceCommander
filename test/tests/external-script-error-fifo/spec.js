var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

var options =  { tolerateList: ['POSTPONING INLINE SCRIPT'] };

testing.test('tests/external-script-error-fifo/index.html', 'External script error fifo test', function () {
    browser.driver.sleep(2000);

    expect(element(by.id('log')).getText()).toEqual('A\nB\nC');
}, options);
