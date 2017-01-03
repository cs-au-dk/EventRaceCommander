// External
var fs = require('fs');
var path = require('path');
var proxy = require('rewriting-proxy');
var util = require('util');

// Internal
var config = require('../config.js').config;
var instrumentJS = require('./instrument-js.js');
var parse5utils = require('../utils/parse5.js');
var utils = require('../utils/utils.js');

function visitNode(node, state) {
    if (!node.tagName) {
        return;
    }

    if (!config.instrument) {
        if (node.tagName === 'head') {
            // Even though the HTML file should not be instrumented, some JavaScript files may still be
            // instrumented. These JavaScript files invoke the API offered by EventRaceCommander.
            // Hence, the file `interface.js` is included in the <head> tag, which simply initializes
            // the API offered by EventRaceCommander to no-op functions.
            parse5utils.prependChild(node, 'script', fs.readFileSync('./src/js/analysis/interface.js'));
        }
        return;
    }

    var attrs = node.attrs || [];
    var srcAttr = parse5utils.getAttribute(node, 'src');

    // Assign this HTML element an id, and store it in the attribute `data-id`
    assignId(node, state);

    switch (node.tagName) {
        case 'head':
            var useCDN = process.env.EVENT_RACE_COMMANDER_CDN === 'true';

            // Set analysis state
            state.analysisStateScript = parse5utils.prependChild(node, 'script', '');

            // Load policy
            parse5utils.prependChild(node, 'script', util.format(
                '%s$_M((function() { var module = { exports: {} }; (function (exports) { %s })(module.exports); return module.exports; })())',
                useCDN ? '' : (fs.readFileSync('out/bundle.js') + ';'), config.rule));

            // Load monitoring script
            if (useCDN) {
                parse5utils.prependChild(node, 'script', { attrs: [{ name: 'src', value: '//cs.au.dk/out/bundle.js' }] });
            }

            // Embed stylesheet
            parse5utils.prependChild(node, 'style', {
                attrs: [{ name: 'type', value: 'text/css' }],
                text: fs.readFileSync(path.join(__dirname, '../../css/modal.css'), { encoding: 'UTF-8' })
            });
            break;

        case 'body':
            // Insert a <div> element, which EventRaceCommander can use for showing a modal
            parse5utils.appendChild(
                parse5utils.insertBefore(
                    node,
                    parse5utils.createElement('div', [{ name: 'id', value: 'event-race-commander-modal' }]),
                    node.childNodes[0]),
                parse5utils.createElement('img', [{ name: 'src', value: '//cs.au.dk/out/loader.gif' }]));
            break;

        case 'iframe':
        case 'img':
            if (srcAttr && srcAttr.value) {
                // Skip instrumentation of <iframe> elements
                srcAttr.value = utils.augmentUrl(srcAttr.value, { name: 'instr', value: '0' });

                // Fork request events
                parse5utils.insertBefore(
                    node.parentNode,
                    parse5utils.createElement('script', util.format(
                        '$_M.onEvent($_L.Event.next(new $_S.OID(\'%s\', %s), \'request\', undefined, undefined), null, this);',
                        node.tagName, node.allocNum)),
                    node);
            }
            break;

        case 'script':
            // Remove integrity attributes
            for (var i = attrs.length-1; i >= 0; --i) {
                if (attrs[i].name.toLowerCase() === 'integrity') {
                    attrs.splice(i, 1);
                }
            }

            // Add an identifier to the URL of scripts that are being loaded,
            // so that it is possible to recognize the response of a given request
            if (srcAttr) {
                srcAttr.value = utils.augmentScriptUrl(srcAttr.value, node.allocNum);
            }

            // Inject a fork script event, if the script is JavaScript
            var typeAttr = parse5utils.getAttribute(node, 'type');
            if (!typeAttr || typeAttr.value.toLowerCase() === 'text/javascript') {
                var asyncAttr = parse5utils.getAttribute(node, 'async');
                var deferAttr = parse5utils.getAttribute(node, 'defer');

                parse5utils.insertBefore(
                    node.parentNode,
                    parse5utils.createElement('script', util.format(
                        '$_M.onEvent($_L.Event.next(new $_S.OID(\'script\', %s), \'request\', undefined, %s), null, this);',
                        node.allocNum, JSON.stringify({
                            async: !!(asyncAttr && asyncAttr.value !== 'false'),
                            defer: !!(deferAttr && deferAttr.value !== 'false'),
                            inline: !srcAttr,
                            url: srcAttr ? srcAttr.value : ''
                        }))),
                    node);
            }
            break;
    }

    if (state.analysisStateScript) {
        state.analysisStateScript.childNodes[0].value = util.format('$_S.setOIDs(%s);', JSON.stringify(state.allocNums));
    }
}

function assignId(node, state) {
    if (!node.allocNum) {
        var attr = { name: 'data-id', value: null };
        node.attrs.push(attr);

        if (node.tagName === 'script') {
            // If two script tags on the web page has the same 'src' value,
            // then the browser only fetches the tag once. To avoid a unnecessary slowdown
            // for augmenting the url with the 'allocNum' query parameter, we use the same
            // object ID for all scripts that are statically declared in the HTML and 
            // has the same 'src' value.
            var srcAttr = parse5utils.getAttribute(node, 'src');
            if (srcAttr) {
                if (state.scriptAllocIds[srcAttr.value]) {
                    node.allocNum = state.scriptAllocIds[srcAttr.value];
                } else {
                    node.allocNum = state.scriptAllocIds[srcAttr.value] = state.allocNums[node.tagName] = (state.allocNums[node.tagName] || 0) + 1;
                }
                attr.value = node.allocNum.toString();
                return;
            }
        }

        node.allocNum = state.allocNums[node.tagName] = (state.allocNums[node.tagName] || 0) + 1;
        attr.value = node.allocNum.toString();
    }
}

module.exports = function (input) {
    var state = { allocNums: {}, analysisStateScript: null, scriptAllocIds: {} };
    var inlineRewriter = function (src, metadata) {
        var node = metadata.node;

        assignId(node, state);

        var allowReturnOutsideFunction = metadata.type === 'event-handler' || metadata.type === 'javascript-url';
        var output = instrumentJS(src, {
            allocName: node.tagName,
            allocNum: node.allocNum,
            allowReturnOutsideFunction: allowReturnOutsideFunction,
            event: allowReturnOutsideFunction ? 'event' : 'undefined',
            eventName: allowReturnOutsideFunction ? utils.getEvtNameFromAttrName(metadata.name) : 'execute',
            receiver: metadata.type === 'event-handler' ? 'this' : metadata.type === 'javascript-url' ? node.allocNum : 'window'
        });
        return output;
    };
    return proxy.rewriteHTML(input, 'http://foo.com/', inlineRewriter, null, null, {
        onNodeVisited: function (node) { visitNode(node, state); },
        locationInfo: false
    });
};
