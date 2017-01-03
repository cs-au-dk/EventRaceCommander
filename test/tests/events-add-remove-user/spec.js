var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('tests/events-add-remove-user/index.html', 'Events add remove user test', function () {
	element(by.id('b1')).click();
	element(by.id('b2')).click();
	element(by.id('b3')).click();

	browser.driver.sleep(3000);

	element(by.id('b1')).click();
	element(by.id('b2')).click();
	element(by.id('b3')).click();

    expect(element(by.id('log')).getText()).toEqual('handler2\nhandler4\nlate\ninlinehandler3\nhandler2\nhandler4\nlate\ninlinehandler3');
});
