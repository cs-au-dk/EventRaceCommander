var argv = browser.params;
var path = require('path');
var testing = require(path.relative(__dirname, argv.testing));

var options =  { tolerateList: ['POSTPONING INLINE SCRIPT'] };

testing.test('races-that-matter/fig-1/index.html', 'Races That Matter Fig. 1', function() {
    testing.waitForText('#log', 'WRITE 1\nWRITE 2\nWRITE 3', 3000);
}, options);
