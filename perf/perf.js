#!/usr/bin/env node

var argv = require('yargs')
    .usage('Usage: ./perf.js --id <string> --site <string> --url <string> [--iterations <number>]')
    .option('delta', { default: 2500, type: 'number' })
    .option('id', { demand: true, type: 'string' })
    .option('timeout', { default: 2500, type: 'number' })
    .option('iterations', { default: 1, type: 'number' })
    .option('warmup', { default: 3, type: 'number' })
    .option('maxTimeout', { default: 15000, type: 'number' })
    .option('site', { demand: true, type: 'string' })
    .option('toleratedPendingNetwork', { default: 0, type: 'number' })
    .option('toleratedPendingTimers', { default: 0, type: 'number' })
    .option('url', { demand: true, type: 'string' })
    .option('warmupTimeout', { default: 15000, type: 'number' })
    .argv;

// External
var Chrome = require('chrome-remote-interface');
var colors = require('colors');
var copy = require('cp-r');
var cp = require('child_process');
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var fs = require('fs');
var lsof = require('lsof');
var mkdirp = require('mkdirp');
var os = require('os');
var path = require('path');
var Q = require('q');
var sanitize = require('sanitize-filename');
var util = require('util');

// Internal
var postProcess = require('./post-processing.js');

var reportdir = path.join(__dirname, 'report');
var reportdestdir = path.join('out/report');

var datadir = path.join('out/data', argv.site);

(function (iterations, url, timeout, warmupTimeout) {
    copy(reportdir, reportdestdir).then(function next() {
        var i = 1;
        var outdir = path.join(datadir, argv.id);
        while (fs.existsSync(path.join(outdir, i.toString()))) ++i;
        outdir = path.join(outdir, i.toString());

        if (iterations > 0 && i <= argv.iterations) {
            var warmup = iterations > argv.iterations;
            run(url, outdir, warmup ? warmupTimeout : timeout, warmup, false).then(next);
            --iterations;
        } else {
            var report = { name: argv.site, ids: [], info: { url: url } };
            mkdirp(datadir, function () {
                fs.readdirSync(datadir).forEach(function (id) {
                    var iddir = path.join(datadir, id);
                    if (fs.statSync(iddir).isDirectory()) {
                        var iterations = [];
                        report.ids.push({ name: id, iterations: iterations });
                        fs.readdirSync(iddir).forEach(function (iteration) {
                            iterations.push({ name: iteration });
                        });
                    }
                });
                postProcess(report, datadir, function () {
                    fs.writeFileSync(path.join(datadir, 'perf-report.json'), JSON.stringify(report));
                });
            });
        }
    });
})(argv.iterations + argv.warmup, argv.url, argv.timeout, argv.warmupTimeout instanceof Array ? argv.warmupTimeout[argv.warmupTimeout.length-1] : argv.warmupTimeout);

var firstRun = true;

function startProxy() {
    var deferred = Q.defer();

    var recording = path.join('recordings', argv.site, 'recording.out');
    if (!fs.existsSync(recording)) {
        console.log(util.format('No such recording: \'%s\'', recording).red.bold);
        deferred.reject();
        return deferred.promise;
    }

    stopProxy(8081).then(function () {
        var mitmdumpArgs = [
            '-p', '8081', '--server-replay', path.join('recordings', argv.site, 'recording.out'),
            '--anticache', '--no-http2', '--no-pop', '--replay-kill-extra', '--server-replay-use-header', 'Host'];
        var proxyArgs = ['--config', path.join('recordings', argv.site, 'recording.config')];
        var env = process.env;

        if (firstRun) {
            proxyArgs.push('--clear-cache');
            firstRun = false;
        }

        if (process.env.EVENT_RACE_COMMANDER_SPEC) {
            var specification = JSON.parse(process.env.EVENT_RACE_COMMANDER_SPEC);
            if (specification.proxyArgs) {
                Array.prototype.push.apply(proxyArgs, specification.proxyArgs);
            }
            if (specification.env) {
                env = makeEnv(specification.env);
            }
        }

        mitmdumpArgs.push('-s', util.format('mitmproxy/proxy.py %s', proxyArgs.join(' ')));

        console.log(util.format('mitmdump %s', mitmdumpArgs.join(' ')).blue.bold);

        var ps = cp.spawn('mitmdump', mitmdumpArgs, { env: env, stdio: 'inherit' });

        ps.on('close', function (code) {
            if (code && !deferred.promise.isFulfilled()) {
                deferred.reject();
            }
        });

        // Resolve the promise when the proxy seems to have started
        // (keep checking every 200 ms)
        var interval = 200, waited = 0, maxWait = 20000;
        var intervalId = setInterval(function () {
            isProxyStarted(8081).then(function (proxyStarted) {
                if (proxyStarted) {
                    deferred.resolve();
                    clearInterval(intervalId);
                } else if (waited >= maxWait) {
                    // Timeout, 20s have elapsed and mitmproxy is still not there!
                    deferred.reject();
                } else {
                    waited += interval;
                }
            });
        }, interval);
    });

    return deferred.promise;
}

function isProxyStarted(port) {
    var deferred = Q.defer();
    lsof.rawTcpPort(port, function (data) {
        deferred.resolve(data.length > 0);
    });
    return deferred.promise;
}

function stopProxy(port) {
    var deferred = Q.defer();
    lsof.rawTcpPort(port, function (data) {
        data.forEach(function (p) { process.kill(p.pid); });
        deferred.resolve();
    });
    return deferred.promise;
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

function run(url, outdir, timeout, warmup, retry) {
    var deferred = Q.defer();

    startProxy().then(function () {
        exec(util.format(
            '%s --proxy-server="127.0.0.1:8081" --proxy-bypass-list="" --remote-debugging-port=9222 --disk-cache-dir=/dev/null --media-cache-dir=/dev/null',
            os.platform() === 'darwin' ? 'open -a \'Google Chrome\' --args' : 'google-chrome'));

        // Give Chrome plenty of time to start...
        setTimeout(function () {
            Chrome(function (chrome) {
                chrome.Page.enable();

                var networkMonitor = new NetworkMonitor(chrome, url);
                var tracingMonitor = new TracingMonitor(chrome, url);

                chrome.once('ready', function () {
                    if (timeout === argv.timeout) {
                        console.log('Tracing ' + url + ' (timeout: ' + timeout + 'ms, warmup: ' + warmup + ')');
                    }
                    tracingMonitor.start();
                    chrome.Page.navigate({ 'url': url });
                });

                setTimeout(function () {
                    tracingMonitor.end(function () {
                        // Shutdown
                        chrome.close();
                        killChrome();

                        if ((networkMonitor.pending.length > argv.toleratedPendingNetwork ||
                                tracingMonitor.pendingTimerIds.length > argv.toleratedPendingTimers) &&
                                timeout < argv.maxTimeout) {
                            console.log(util.format('... increasing timeout (network: %s, timers: %s)',
                                networkMonitor.pending.length, tracingMonitor.pendingTimerIds.length));
                            // Make sure that Chrome has been closed before continuing
                            setTimeout(function () {
                                run(url, outdir, timeout + argv.delta, warmup, false).then(function () {
                                    deferred.resolve();
                                });
                            }, 4000);
                            return;
                        }

                        if (networkMonitor.pending.length < argv.toleratedPendingNetwork &&
                                tracingMonitor.pendingTimerIds.length < argv.toleratedPendingTimers) {
                            console.log('... timed out');
                        }

                        if (warmup) {
                            console.log('Skipping measurement due to warmup\n');
                        } else {
                            console.log('Outputting to ' + outdir + '\n');

                            mkdirp(datadir, function () {
                                mkdirp(outdir, function () {
                                    fs.writeFileSync(path.join(outdir, 'network.json'), JSON.stringify(networkMonitor.messages, null, 2));
                                    fs.writeFileSync(path.join(outdir, 'tracing.json'), JSON.stringify(tracingMonitor.getMessages(), null, 2));
                                });
                            });
                        }

                        // Make sure that Chrome has been closed before continuing
                        setTimeout(function () {
                            deferred.resolve();
                        }, 4000);
                    });
                }, timeout);
            }).on('error', function () {
                console.error('Cannot connect to Chrome (force killing all instances of Chrome).');
                killChrome();

                if (!retry) {
                    // Retry in 4000ms
                    setTimeout(function () {
                        run(url, outdir, timeout, warmup, true).then(function () {
                            deferred.resolve();
                        });
                    }, 4000);
                } else {
                    process.exit(-1);
                }
            });
        }, 2500);
    });

    return deferred.promise.then(stopProxy.bind(null, 8081));
}

function killChrome() {
    execSync(util.format(
        'pkill %s',
        os.platform() === 'darwin' ? '\'Google Chrome\'' : 'chrome'));
}

function NetworkMonitor(chrome, url) {
    this.messages = [];
    this.pending = [];

    chrome.Network.enable();

    chrome.Network.requestWillBeSent(function (message) {
        this.messages.push({ 'name': 'requestWillBeSent', 'message': message });
        if (this.pending.indexOf(message.requestId) < 0) {
            this.pending.push(message.requestId);
        }
    }.bind(this));

    chrome.Network.loadingFailed(function (message) {
        this.messages.push({ 'name': 'loadingFailed', 'message': message });
        this.pending.splice(
            this.pending.indexOf(message.requestId), 1);
    }.bind(this));

    chrome.Network.loadingFinished(function (message) {
        this.messages.push({ 'name': 'loadingFinished', 'message': message });
        this.pending.splice(
            this.pending.indexOf(message.requestId), 1);
    }.bind(this));
}

function TracingMonitor(chrome, url) {
    var messages = [];

    this.pendingResources = [];
    this.pendingTimerIds = [];

    this.onTracingComplete = null;

    this.start = function () {
        chrome.Tracing.start({
            'categories': 'devtools.timeline',
            'options': 'sampling-frequency=10000' // 1000 is default and too slow
        });
    };

    this.end = function (cb) {
        chrome.Tracing.end();
        this.onTracingComplete = cb;
    };

    /**
     * Filter messages.
     */
    this.getMessages = function () {
        var result = [];
        var pid = -1;
        for (var i = 0, n = messages.length; i < n; ++i) {
            var e = messages[i];
            if (e.name === 'ResourceSendRequest' && e.args.data.url === url) {
                pid = e.pid;
                break;
            }
        }
        for (var i = 0, n = messages.length; i < n; ++i) {
            var e = messages[i];
            if (e.cat === '__metadata' ||
                e.name === 'CommitLoad' ||
                e.name === 'FunctionCall' ||
                e.name === 'MajorGC' ||
                e.name === 'MinorGC' ||
                e.name === 'v8.compile' ||
                (pid !== -1 && e.pid !== pid)) {
                continue;
            }
            result.push(e);
        }
        return result;
    };

    chrome.Tracing.dataCollected(function(data) {
        messages = messages.concat(data.value);
    }.bind(this));

    chrome.Tracing.tracingComplete(function () {
        for (var i = 0, n = messages.length; i < n; ++i) {
            var e = messages[i];
            switch (e.name) {
                case 'ResourceSendRequest':
                    this.pendingResources.push(e);
                    break;

                case 'ResourceFinish':
                    var req;
                    for (var j = 0, m = this.pendingResources.length; j < m; ++j) {
                        var other = this.pendingResources[j];
                        if (e.args.data.requestId === other.args.data.requestId) {
                            req = other;
                            break;
                        }
                    }
                    // For some reason, there may be multiple requests to the same URL,
                    // while only one finishes (?)...
                    if (req) {
                        for (var j = this.pendingResources.length-1; j >= 0; --j) {
                            var other = this.pendingResources[j];
                            if (req.args.data.url === other.args.data.url) {
                                this.pendingResources.splice(j, 1);
                            }
                        }
                    }
                    break;

                case 'TimerInstall':
                    var idx = this.pendingTimerIds.indexOf(e.args.data.timerId);
                    if (idx < 0) {
                        this.pendingTimerIds.push(e.args.data.timerId);
                    }
                    break;

                case 'TimerFire':
                case 'TimerRemove':
                    var idx = this.pendingTimerIds.indexOf(e.args.data.timerId);
                    if (idx >= 0) {
                        this.pendingTimerIds.splice(idx, 1);
                    }
                    break;
            }
        }

        if (this.onTracingComplete) {
            this.onTracingComplete();
        }
    }.bind(this));
}
