#!/usr/bin/env node

var UglifyJS = require('uglify-js');

function minify(input) {
	try {
    	return UglifyJS.minify(input, { fromString: true }).code;
    } catch (e) {
    	return input;
    }
}

if (require.main === module) {
    var input = '';

    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', function (data) {
        input += data;
    });
    process.stdin.on('end', function () {
        process.stdout.write(minify(input));
    });
}
