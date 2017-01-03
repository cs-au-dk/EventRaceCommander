#!/usr/bin/env node

// External
var argv = require('yargs')
    .usage('Usage: instrument.js --kind <html, js> [--o <file>]')
    .example('instrument --kind js --o out.js', 'Instruments the JavaScript passed to stdin, and outputs the result to out.js')
    .option('kind', {
        demand: true,
        describe: 'The content type to instrument (\'html\' or \'js\')',
        options: ['html', 'js'] })
    .option('o', {
        demand: false,
        describe: 'Where to output the result (if unspecified, stdout is used)' })
    .argv;

var fs = require('fs');
var url = require('url');

// Internal
var instrumentHtml = require('../instrumentation/instrument-html.js');
var instrumentJavaScript = require('../instrumentation/instrument-js.js');

if (require.main === module) {
    var input = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', function (data) {
        input += data;
    });
    process.stdin.on('end', function () {
        var output;
        if (argv.kind === 'html') {
            output = instrumentHtml(input);
        } else {
            var options = {
                allocName: 'script',
                allowReturnOutsideFunction: false,
                eventName: 'execute',
                isExternal: true
            };

            // The allocation site of files may be provided in the URL
            if (process.env.EVENT_RACE_COMMANDER_URL) {
                var query = url.parse(process.env.EVENT_RACE_COMMANDER_URL, true).query;
                if (query.allocNum) {
                    options.allocNum = parseInt(query.allocNum);
                }
            }

            output = instrumentJavaScript(input, options);
        }
        
        if (argv.o) {
            fs.writeFile(argv.o, output.toString());
        } else {
            process.stdout.write(output.toString());
        }
    });
}
