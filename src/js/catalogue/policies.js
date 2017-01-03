var api = require('../analysis/api.js');
var queries = require('./queries.js');

var executionOf = api.Event.executionOf;
var Observer = api.Observer;
var responseOf = api.Event.responseOf;

function isScriptRequest(op) {
    return op.oid.name === 'script' && op.name === 'request';
}

/**
 * Postpones events matched by `targetQuery` during page loading.
 *
 * Parameters:
 * - `targetQuery`: mandatory; the events to postpone or block,
 * - `loadedQuery`: optional; defaults to queries.DOMContentLoaded,
 * - `requestQuery`: optional; if given, then user events are postponed
 *   until all response events that have been matched by `requestQuery`
 *   (during loading) have been dispatched,
 * - `options`: uses discard action rather than postpone, if `options.shouldBlock` is set.
 */
function postponeWhileLoading(targetQuery, loadedQuery, requestQuery, options) {
    if (!loadedQuery) {
        loadedQuery = queries.DOMContentLoaded;
    }
    if (requestQuery) {
        // A set of operation predicates that must be satisfied
        // before this rule can expire.
        var pending = [loadedQuery];

        return {
            // Create an observer (i.e., a rule that never discards or postpones any events)
            // that keeps generating new rules until all responses of requests matched by
            // `requestQuery` have been dispatched.
            observers: [
                new Observer({
                    query: requestQuery,
                    fork: function (op) {
                        var responseQuery = responseOf(op);
                        pending.push(responseQuery);
                        return responseQuery.before(targetQuery, options);
                    },
                    expired: function (/*Event*/ evt) {
                        for (var i = pending.length-1; i >= 0; --i) {
                            if (pending[i].matches(evt)) {
                                pending.splice(i, 1);
                            }
                        }
                        return pending.length === 0;
                    }
                })
            ],

            // Create a rule that postpones events matched by `targetQuery`
            // until `loadedQuery` has been satisfied
            rules: [loadedQuery.before(targetQuery, options)]
        };
    }

    // Create a rule that postpones events matched by `targetQuery`
    // until `loadedQuery` has been satisfied
    return loadedQuery.before(targetQuery, options);
}

/**
 * Postpones system response events during loading, whose request
 * event is matched by the operation predicate `requestQuery`.
 *
 * Parameters:
 * - `requestQuery`: mandatory,
 * - `loadedQuery`: optional, defaults to queries.DOMContentLoaded.
 */
function postponeResponsesWhileLoading(requestQuery, loadedQuery) {
    if (!loadedQuery) {
        loadedQuery = queries.DOMContentLoaded;
    }

    // Return an observer, i.e., a rule that never discards
    // or postpones any events, but only forks new rules.
    return new Observer({
        query: requestQuery,
        fork: function (op) {
            // If the operation is a script request, then discard/postpone
            // the execution of the script until the page has loaded.
            if (isScriptRequest(op)) {
                return loadedQuery.before(executionOf(op));
            }

            // Otherwise postpone the response event until the page has loaded.
            return loadedQuery.before(responseOf(op));
        },
        expired: function (/*Event*/ evt) {
            // This rule expires when an event that matches `loadedQuery` is dispatched.
            return loadedQuery.matches(evt);
        }
    });
}

/**
 * Postpones system response events, whose request event is matched by `requestQuery`,
 * until all scripts that have been statically declared in the DOM have loaded.
 *
 * Parameters:
 * - `requestQuery`: mandatory.
 */
 function postponeResponsesWhileLoadingStaticScripts(requestQuery) {
    // Return a set of observers, i.e., rules that never discard or postpone any events.
    return {
        observers: [
            // Use the previously policy to postpone the relevant system response events
            // until the DOMContentLoaded event has been dispatched.
            postponeResponsesWhileLoading(requestQuery),

            // Additionally wait until all external scripts have been loaded (asynchronous
            // scripts may not load before the DOMContentLoaded event fires).
            new Observer({
                query: requestQuery.or(queries.externalScriptRequest),
                fork: function (op) {
                    return new Observer({
                        query: requestQuery.or(queries.externalScriptRequest),
                        fork: function (other) {
                            this.hasExpired = true;

                            if (isScriptRequest(op)) {
                                if (!isScriptRequest(other)) {
                                    // Enforce that `other` (which has been matched by `requestQuery`)
                                    // happens after the script `op` has loaded (which has been
                                    // matched by `externalScriptRequest`).
                                    return responseOf(op).before(executionOf(other));
                                }
                            } else if (isScriptRequest(other)) {
                                // Enforce that `op` (which has been matched by `requestQuery`)
                                // happens after the script `other` has loaded (which has been
                                // matched by `externalScriptRequest`).
                                return responseOf(other).before(responseOf(op));
                            }
                        },
                        expired: function (/*Event*/ evt) {
                            // This rules expires when the response of op has been dispatched.
                            return this.hasExpired || (isScriptRequest(op) && responseOf(op).matches(evt));
                        }
                    });
                },
                expired: function (/*Event*/ evt) {
                    // This rule expires when DOMContentLoaded has been dispatched (i.e., when the
                    // page has been parsed and all statically declared scripts have been parsed).
                    return queries.DOMContentLoaded.matches(evt);
                }
            })
        ]
    };
}

/**
 * Postpones events matched by `targetQuery` while asynchronous
 * events (Ajax, asynchronous script loading) are pending.
 *
 * Parameters:
 * - `targetQuery`: mandatory.
 */
function postponeWhileAsync(targetQuery, options) {
    return new Observer({
        query: queries.networkRequest,
        fork: function (op) {
            return responseOf(op).before(targetQuery, options);
        }
    });
}

function fifo(requestQuery) {
    return new Observer({
        query: requestQuery,
        fork: function (op) {
            return new Observer({
                query: requestQuery,
                fork: function (other) {
                    if (isScriptRequest(other)) {
                        return {
                            // Waiting for the execution of other is not sufficient, since the script loading
                            // may fail, meaning that there will be no script execute event (yet, we should
                            // postpone the error event)
                            rules: [
                                responseOf(op).before(executionOf(other)),
                                responseOf(op).before(responseOf(other))
                            ]
                        };
                    }
                    return responseOf(op).before(responseOf(other));
                },
                expired: function (/*Event*/ evt) {
                    return responseOf(op).matches(evt) || this.query.matches(evt);
                }
            });
        }
    });
}

module.exports = {
    // Initialization policies
    postponeWhileLoading: postponeWhileLoading,
    postponeResponsesWhileLoading: postponeResponsesWhileLoading,
    postponeResponsesWhileLoadingStaticScripts: postponeResponsesWhileLoadingStaticScripts,

    // Post-initialization policies
    postponeWhileAsync: postponeWhileAsync,

    // FIFO ordering
    fifo: fifo,
    ajaxFifo: fifo.bind(null, queries.ajaxRequest),
    networkFifo: fifo.bind(null, queries.networkRequest),
    scriptFifo: fifo.bind(null, queries.externalScriptRequest)
};
