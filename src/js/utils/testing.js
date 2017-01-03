exports.checkLogs = function (tolerateList) {
    browser.manage().logs().get('browser').then(function(browserLog) {
        var logs = [];
        for (var i = 0; i < browserLog.length; i++) {
            var log = browserLog[i];
            var tolerate = false;
            try {
                var message = JSON.parse(log.message).message;
                if (message.level === 'info') {
                    tolerate = true;
                }
            } catch (e) {
                if (log.message.indexOf(
                        'Synchronous XMLHttpRequest on the main thread is deprecated because ' +
                        'of its detrimental effects to the end user\'s experience') >= 0 ||
                    log.message.indexOf(
                        'Failed to load resource: ' +
                        'the server responded with a status of 404 (Not Found)') >= 0 ||
                    log.message.indexOf(
                        'Failed to load resource: ' +
                        'the server responded with a status of 502 (Bad Gateway)') >= 0 ||
                    log.message.indexOf(
                        'No \'Access-Control-Allow-Origin\' header is present on the requested resource.') >= 0 ||
                    log.message.indexOf(' is deprecated.') >= 0) {
                    tolerate = true;
                } else if (tolerateList) {
                    for (var j = 0; j < tolerateList.length; ++j) {
                        if (log.message.indexOf(tolerateList[j])) {
                            tolerate = true;
                            break;
                        }
                    }
                }
            }

            if (!tolerate) {
                console.log(log);
                logs.push(log);
            }
        }
        expect(logs.length).toEqual(0);
    });
};

exports.waitForText = function (cssSelector, text, timeout) {
    browser.wait(function () {
        return element(by.css(cssSelector)).getText().then(function (actual) {
            return actual === text;
        });
    }, timeout);
};
