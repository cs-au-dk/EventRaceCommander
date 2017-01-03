#!/usr/bin/env node

var argv = require('yargs')
    .usage('Usage: ./run-experiments.js [--replay] [--sites <sites.json>] [--args=<args>]')
    .option('args', { default: '--iterations 50', type: 'string' })
    .option('sites', { default: 'fortune20.json', type: 'string' })
    .option('verbose', { default: false, type: 'boolean' })
    .argv;

// External
var colors = require('colors');
var cp = require('child_process');
var fs = require('fs');
var lsof = require('lsof');
var path = require('path');
var psTree = require('ps-tree');
var Q = require('q');
var util = require('util');

// Internal
var build = require('./src/js/commands/build.js');

if (!fs.existsSync(argv.sites)) {
    console.log(util.format('Not a file: \'%s\'.', argv.sites));
    process.exit(1);
}

var sites = JSON.parse(fs.readFileSync(argv.sites));
var succeeded = 0;
var failed = 0;

(function next() {
    if (!sites.length) {
        console.log('Finished batch execution'.blue.bold);
        console.log('Succeeded: ' + succeeded);
        console.log('Failed: ' + failed);
        process.exit(failed.length);
    }

    runSpecifications(sites.shift()).then(next).catch(handleError);
})();

function runSpecifications(site) {
    var specifications = site.specifications;
    var promise = runSpecification(site, specifications[0]);
    for (var i = 1; i < specifications.length; ++i) {
        (function (specification) {
            promise = promise.then(runSpecification.bind(null, site, specification));
        })(specifications[i]);
    }
    return promise;
}

function runSpecification(site, specification) {
    return build(
            specification.env.EVENT_RACE_COMMANDER_MINIFY !== 'false',
            specification.env.EVENT_RACE_COMMANDER_DISABLE !== 'false',
            specification.env.EVENT_RACE_COMMANDER_BROADCAST === 'true')
        .then(runScript.bind(null, site, specification));
}

function runScript(site, specification) {
    var deferred = Q.defer();

    var args = ['--site', site.name, '--url', site.url];
    if (specification) {
        for (var key in specification) {
            if (typeof specification[key] !== 'object') {
                args.push(util.format('--%s', key), specification[key]);
            }
        }
    }
    Array.prototype.push.apply(args, argv.args.split(' '));

    console.log(('perf/perf.js ' + args.join(' ')).blue.bold);

    var ps = cp.spawn('perf/perf.js', args, { cwd: process.cwd, env: makeEnv({
        EVENT_RACE_COMMANDER_SPEC: JSON.stringify(specification)
    }), stdio: 'inherit' });

    ps.on('close', function (code) {
        if (code) {
            ++failed;
        } else {
            ++succeeded;
        }
        deferred.resolve();
    });

    return deferred.promise;
}

function handleError(e) {
    console.log('Error:', e);
}

function makeEnv(envVars) {
    var env = Object.create(process.env);
    if (envVars) {
        for (var variable in envVars) {
            if (envVars.hasOwnProperty(variable)) {
                env[variable] = envVars[variable];
            }
        }
    }
    return env;
}
