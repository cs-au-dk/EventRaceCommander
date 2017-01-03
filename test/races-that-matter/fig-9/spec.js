var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

testing.test('races-that-matter/fig-9/index.html', 'Races That Matter Fig. 9', function() {
    element(by.id('a1')).click();
    element(by.id('a2')).click();

    browser.driver.sleep(4000);

    var article = element(by.id('article'));
    expect(article.getText()).toContain('Article 2');
});
