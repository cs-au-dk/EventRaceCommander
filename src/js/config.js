// External
var fs = require('fs');
var path = require('path');
var url = require('url');

function getRule(ruleIds, { hostname, pathname }) {
    if (process.env.EVENT_RACE_COMMANDER_URL && process.env.EVENT_RACE_COMMANDER_POLICY !== 'none') {
        pathname = path.join(pathname, 'index.html').replace(/\~/g, '');
        while (ruleIds.length) {
            var rule = path.join(
                __dirname, '../..', path.dirname('policies/' + hostname + pathname),
                ruleIds.pop() + '.js');
            if (fs.existsSync(rule)) {
                return fs.readFileSync(rule, { encoding: 'UTF-8' });
            }
        }
    }
    return "module.exports = function () {};";
}

var config = {
    instrument: !process.env.EVENT_RACE_COMMANDER_URL || process.env.EVENT_RACE_COMMANDER_URL.indexOf('instr=0') <= 0,
    rule: getRule(
        ['app-independent', process.env.EVENT_RACE_COMMANDER_POLICY || 'rule'],
        url.parse(process.env.EVENT_RACE_COMMANDER_URL, false))
};

exports.config = config;
