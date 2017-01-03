var api = require('./api.js');
var Graph = require('../utils/graph.js');

var hb = new Graph();

var lastStaticSyncScript = null, lastDynamicSyncScript = null;

function eventEmitted(/*Event*/ eventInfo, policy) {
    if (policy.allowPostponingSyncScripts) {
        if (eventInfo.oid.name === 'script' && eventInfo.name === 'request') {
            var metadata = eventInfo.metadata;
            if (metadata && !metadata.async && !metadata.defer) {
                var nextSyncScript = new api.Event(eventInfo.oid, 'execute', eventInfo.num);
                if (metadata.injected) {
                    if (lastDynamicSyncScript) {
                        hb.addEdge(lastDynamicSyncScript.id, nextSyncScript.id);
                    }
                    lastDynamicSyncScript = nextSyncScript;
                } else {
                    if (lastStaticSyncScript) {
                        hb.addEdge(lastStaticSyncScript.id, nextSyncScript.id);
                    }
                    lastStaticSyncScript = nextSyncScript;
                }
            }
        }
    }

    if (eventInfo.oid.name === 'script' && eventInfo.name === 'execute') {
        var metadata = eventInfo.metadata;
        if (metadata && !metadata.inline) {
            var scriptLoadEvent = new api.Event(eventInfo.oid, 'load', eventInfo.num);
            hb.addEdge(eventInfo.id, scriptLoadEvent.id);
        }
    }
}

function eventDispatched(/*Event*/ eventInfo) {
    if (lastDynamicSyncScript && lastDynamicSyncScript.equals(eventInfo)) {
        lastDynamicSyncScript = null;
    }
    if (lastStaticSyncScript && lastStaticSyncScript.equals(eventInfo)) {
        lastStaticSyncScript = null;
    }
    hb.removeNodeAndEdges(eventInfo.id);
}

function delayDispatch(/*Event*/ eventInfo) {
    var preds = hb.preds.get(eventInfo.id);
    if (preds && preds.length) {
        return {
            shouldPostpone: true,
            toString: function () {
                return ['POSTPONE UNTIL', preds[0], '<', eventInfo.id].join(' ');
            }
        };
    }
}

module.exports = {
    delayDispatch: delayDispatch,
    eventDispatched: eventDispatched,
    eventEmitted: eventEmitted
};
