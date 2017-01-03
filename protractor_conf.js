var argv = require('yargs')
    .usage('Usage: $0 protractor_conf.js --spec [string]')
    .option('spec', {
      default: '',
      demand: false,
      describe: 'a pattern for filtering specs',
      type: 'string'
    })
    .argv;

var fs = require('fs');
var path = require('path');
var patterns = argv.spec.split(',');

function listSync(dir, guard, acc) {
    acc = acc || [];
    var files = fs.readdirSync(dir);
    for (var i = 0, n = files.length; i < n; i++) {
        var file = dir + '/' + files[i];
        if (fs.statSync(file).isDirectory()) {
            listSync(file, guard, acc);
        } else if (!guard || guard(file)) {
            acc.push(file);
        }
    }
    return acc;
}

exports.config = {
  directConnect: true,

  // Capabilities to be passed to the webdriver instance.
  capabilities: {
    'browserName': 'chrome',
    'chromeOptions': {
      args: ['--no-sandbox', '--proxy-server=127.0.0.1:8081', '--proxy-bypass-list=']
    }
  },

  // Framework to use. Jasmine is recommended.
  framework: 'jasmine',

  // Spec patterns are relative to the current working directly when
  // protractor is called.
  specs: listSync(__dirname, (file) =>
    path.basename(file) === 'spec.js' && file.indexOf(argv.spec) >= 0),

  params: {
    testing: path.join(__dirname, 'src/js/testing/test-driver.js')
  }
};
