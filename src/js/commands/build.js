#!/usr/bin/env node

// External
var browserify = require('browserify');
var copy = require('cp-r');
var fs = require('fs');
var mkdirp = require('mkdirp');
var Q = require('q');
var UglifyJS = require('uglify-js');
var util = require('util');

function build(minify, disable, broadcast) {
    var deferred = Q.defer();

    mkdirp.sync('out');

    copy('src/loader.gif', 'out/loader.gif').then(function () {
        var bundle = browserify()
        .require('./src/js/analysis/main.js', { expose: 'eventracecommander' })
        .bundle();

        var bundleCode = '';
        bundle.on('data', function (data) {
            bundleCode += data;
        });
        bundle.on('end', function() {
            var result = util.format([
                    '(function() {',
                    '  var require;',
                    '  ' + bundleCode,
                    '  require(\'eventracecommander\')(%s, %s);',
                    '})();'
                ].join('\n'), disable, broadcast);
            if (minify) {
                result = UglifyJS.minify(result, { fromString: true }).code;
            }
            fs.writeFile('out/bundle.js', result, function () {
                deferred.resolve();
            });
        });
    });

    return deferred.promise;
}

if (require.main === module) {
    build(
        process.env.EVENT_RACE_COMMANDER_MINIFY !== 'false',
        process.env.EVENT_RACE_COMMANDER_DISABLE !== 'false',
        process.env.EVENT_RACE_COMMANDER_BROADCAST === 'true');
} else {
    module.exports = build;
}
