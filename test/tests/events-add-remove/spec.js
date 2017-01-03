var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('tests/events-add-remove/index.html', 'Events add remove test', function () {
	browser.driver.sleep(3000);

    expect(element(by.id('log')).getText()).toEqual('handler2\nhandler4\nlate');
});
