var api = require('./api.js');
var dom = require('../utils/dom.js');
var natives = require('../utils/natives.js');
var shadowing = require('../utils/shadowing.js');
var utils = require('../utils/utils.js');

function EventMonitor(controller, policy, disable, broadcast) {
    console.log('Enforcing policy:', policy);

    var isFollowerFocusEvent = false;
    var outstanding = 1;
    var self = this;

    this.policy = policy;
    utils.eventify(this);
    
    this.incrementOutstanding = function () {
        ++outstanding;
    };

    this.decrementOutstanding = function () {
        if (--outstanding === 0 && disable) {
            utils.debug('DISABLING INSTRUMENTATION', { kind: 'info' });

            descriptors.forEach(function (descriptor) {
                descriptor.types.forEach(function (type) {
                    descriptor.target.removeEventListener(type, descriptor.handlers[type], false);
                    descriptor.target.removeEventListener(type, descriptor.handlers[type], true);
                });
            });

            controller.disable();
        }
    };

    /**
     * Disable instrumentation once the policy is fully resolved.
     */
    policy.once('resolve', function () {
        self.decrementOutstanding();
    });

    var blocking = {
        counter: 0,
        startIfNeeded: function (eventInfo, decision) {
            if (utils.isUserEventName(eventInfo.name) && decision.feedback !== false && decision.startBlocking(eventInfo)) {
                // Modal/spinner is only started for the first event in a sequence (e.g. mousedown, not mouseup, nor click).
                if (eventInfo.name !== 'click' && eventInfo.name !== 'mouseup') {
                    blocking.start();
                    decision.once('resolve', function () {
                        var newDecision = policy.delayDispatch(eventInfo, decision);
                        if (newDecision) {
                            this.startIfNeeded(eventInfo, newDecision);
                        }
                        blocking.stop();
                    }.bind(this));
                }
            }
        },
        start: function () {
            if (this.counter++ === 0) {
                document.body.classList.add('blocking');
            }
        },
        stop: function () {
            if (--this.counter === 0) {
                document.body.classList.remove('blocking');
            }
            if (this.counter < 0) {
                utils.debug('NEGATIVE BLOCK INDEX', { kind: 'error' });
            }
        }
    };

    this.onEvent = function (eventInfo, listener, receiver) {
        return _onEvent(eventInfo, listener, receiver, false);
    };

    function _onEvent(eventInfo, listener, receiver, seenBefore) {
        var isSyncScript = eventInfo.oid.name === 'script' && eventInfo.name === 'execute' && eventInfo.metadata && eventInfo.metadata.inline;

        if (!seenBefore) {
            // Emit a synthetic request event for inline scripts
            if (isSyncScript) {
                var nextRequestEventInfo = api.Event.peek(eventInfo.oid, 'request', undefined, eventInfo.metadata);
                if (nextRequestEventInfo.num === 1) {
                    var requestEventInfo = api.Event.next(eventInfo.oid, 'request', undefined, eventInfo.metadata);
                    policy.eventEmitted(requestEventInfo, broadcast);
                    utils.debug('DISPATCHED', requestEventInfo.id);
                    policy.eventDispatched(requestEventInfo, broadcast);
                }
            }

            policy.eventEmitted(eventInfo, broadcast);
        }

        // If a rule requires the event to be delayed, make sure to preserve the right order.
        var decision = policy.delayDispatch(eventInfo);
        if (decision) {
            if (policy.allowPostponingSyncScripts || !isSyncScript) {
                utils.debug(eventInfo.id, decision.toString(), eventInfo.metadata);
                
                policy.eventPostponed(eventInfo, broadcast);

                var cb = _onEvent.bind(null, eventInfo, listener, receiver, true);
                natives.props.setTimeout.call(window, cb, 50, true);
                return;
            } else {
                utils.debug('POSTPONING INLINE SCRIPT:', eventInfo, { kind: 'error' });
            }
        }

        try {
            if (listener) {
                if (typeof listener === 'string') {
                    // It is a string passed to for example setTimeout
                    // (should in principle be instrumented!)
                    eval(listener);
                } else {
                    listener.call(receiver, eventInfo.raw);
                }
            }
        } finally {
            if (eventInfo.id.indexOf('timeout') < 0) {
                utils.debug('DISPATCHED', eventInfo.id, eventInfo.metadata || {});
            }
            policy.eventDispatched(eventInfo, broadcast);

            // Emit a synthetic load event for inline scripts such that inline and external script events
            // can be handled similarly from a policy perspective
            if (eventInfo.name === 'execute' && eventInfo.metadata && eventInfo.metadata.inline) {
                var loadEventInfo = api.Event.next(eventInfo.oid, 'load', undefined, eventInfo.metadata);
                policy.eventEmitted(loadEventInfo, broadcast);
                utils.debug('DISPATCHED', loadEventInfo.id);
                policy.eventDispatched(loadEventInfo, broadcast);
            }
        }
    }

    var descriptors = [{
        target: window.document,
        types: 'blur change click DOMContentLoaded error focus input keydown keypress keyup load mousedown mouseover mouseup'.split(' '),
        handlers: {}
    }, {
        target: window,
        types: 'load'.split(' '),
        handlers: {}
    }];

    // Register an event handler for each DOM event at the root of the bubbling/capturing phases
    descriptors.forEach(function (descriptor) {
        descriptor.types.forEach(function (type) {
            // Store the event handlers in descriptor.handlers such that we can remove them by reference later
            descriptor.target.addEventListener(type, descriptor.handlers[type] = function (event) {
                // If it is the load event of a script generated by the instrumentation, then simply ignore
                if (event.target instanceof natives.types.Element && dom.extractTagName(event.target.tagName) === 'script' && event.target.dataset.generated) {
                    return;
                }

                // If it is an event on the modal, then simply discard
                /* if (document.body.classList.contains('blocking')) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    return;
                } */

                if (type === 'focus') {
                    if (event.isFollowerFocusEvent) {
                        // There is no way to tag focus events (they are generated by invoking focus() on the receiver),
                        // therefore we recognize them here
                        event._follower = true;
                    } else if (arguments.callee.caller) {
                        // If it is an event triggered by the JavaScript, then simply ignore
                        return;
                    }
                }

                // For some reason the capturing event handler is not always called (?).
                // For example for mouseup events? Therefore, two event handlers are registered:
                // one for the bubbling and one for the capturing phase, such that event is not "lost".
                if (event.intercepted) {
                    return;
                }
                event.intercepted = true;

                // If the event does not have the _info property, it is an original event fired by the user,
                // otherwise it is one that has been redispatched.
                var eventInfo = event._info;
                if (!eventInfo) {
                    // Compute the next event identifier and emit the event to the policy
                    eventInfo = api.Event.next(shadowing.getOID(event.target), type, event);
                    policy.eventEmitted(eventInfo, broadcast);

                    // Store the target of the event, since it may become reset (by the browser?),
                    // so that we can dispatch it properly later
                    eventInfo.target = event.target;

                    if (type === 'error') {
                        // Fork response event
                        var oid = shadowing.getOID(eventInfo.target);
                        self.onEvent(api.Event.next(oid, utils.getResponseEventName(eventInfo.target)));
                    }
                }

                // The mousedown event does not show the modal/spinner until the succeeding click event has been fired.
                // (Otherwise the mouseup and click event will have the modal/spinner as target.)
                if (type === 'click') {
                    policy.trigger(type);
                }

                // Query the policy and dispatch if OK
                var decision = !event._follower && policy.delayDispatch(eventInfo);
                if (!decision) {
                    // Manually trigger a change event before the blur event
                    if (type === 'blur' && eventInfo.target instanceof natives.types.Element && dom.extractTagName(eventInfo.target.tagName) === 'input') {
                        if (eventInfo.target.dataset.oldValue !== undefined) {
                            if (eventInfo.target.dataset.oldValue !== eventInfo.target.value) {
                                var changeEvent = new Event('change', {
                                    bubbles: true,
                                    cancelable: false,
                                    view: window
                                });
                                eventInfo.target.dispatchEvent(changeEvent);
                            }
                            delete eventInfo.target.dataset.oldValue;
                            self.decrementOutstanding();
                        }
                    }

                    var log = eventInfo.name !== 'mouseover';
                    if (log) utils.debug('DISPATCH', eventInfo.id, eventInfo.metadata || '');
                    natives.props.setTimeout.call(window, function () {
                        if (log) utils.debug('DISPATCHED', eventInfo.id, eventInfo.metadata || '');
                        policy.eventDispatched(eventInfo, broadcast);
                    }, 0, true);
                    return;
                }

                // We are discarding or postponing the event (in the case of postponement, we will
                // manually make sure that the default is not prevented, e.g. by inserting the
                // right character into the text field in case of a keydown event...)
                event.preventDefault();
                event.stopImmediatePropagation();

                /*if (type === 'focus') {
                    // Cannot prevent the focus with preventDefault()
                    eventInfo.raw.target.blur();
                }*/

                blocking.startIfNeeded(eventInfo, decision);

                if (decision.shouldBlock) {
                    utils.debug('BLOCK', eventInfo.id, 'DECISION:', decision.toString());
                } else if (decision.shouldPostpone) {
                    utils.debug('POSTPONE', eventInfo.id, 'DECISION:', decision.toString());
                    forkPostponement(eventInfo);
                }
            }, true);
            descriptor.target.addEventListener(type, descriptor.handlers[type], false);
        });
    });

    function forkPostponement(eventInfo) {
        var e = new eventInfo.raw.constructor(eventInfo.raw.type, {
            bubbles: true, cancelable: true, view: window
        });

        // Tag the raw events so that we can recognize them later
        e._info = eventInfo.raw._info = eventInfo;

        // Contionously try every 100ms
        natives.props.setTimeout.call(window, function () {
            if (eventInfo.target.dispatchEvent(e)) {
                // Only trigger following events if default is not prevented
                dispatchFollowers(eventInfo);
            }
        }, 50, true);
    }

    function dispatchFollowers(eventInfo) {
        if (eventInfo.raw.type === 'keydown') {
            if (eventInfo.target instanceof natives.types.Element &&
                    dom.extractTagName(eventInfo.target.tagName) === 'input') {
                var key = String.fromCharCode(eventInfo.raw.keyCode);
                if (eventInfo.raw.shiftKey + eventInfo.raw.getModifierState('CapsLock') !== 1) {
                    key = key.toLowerCase();
                }

                // Dispatch keypress event
                var keypressEvent = new KeyboardEvent('keypress', {
                    bubbles: true,
                    cancelable: true,
                    key: key,
                    charCode: eventInfo.raw.keyCode,
                    keyCode: eventInfo.raw.keyCode,
                    which: eventInfo.raw.keyCode,
                    view: window
                });
                keypressEvent._follower = true;
                eventInfo.target.dispatchEvent(keypressEvent);

                // Insert character
                if (!keypressEvent.defaultPrevented) {
                    if (eventInfo.target.dataset.oldValue === undefined) {
                        eventInfo.target.dataset.oldValue = eventInfo.target.value;
                        self.incrementOutstanding();
                    }

                    if (eventInfo.raw.keyCode === 8) {
                        // Backspace
                        utils.deleteAtCursor(eventInfo.target);
                    } else if (eventInfo.raw.keyCode === 46) {
                        // Delete
                        utils.deleteAtCursor(eventInfo.target, true);
                    } else {
                        utils.insertAtCursor(eventInfo.target, key);
                    }
                }

                // Dispatch input event
                var inputEvent = new Event('input', {
                    bubbles: true,
                    cancelable: false,
                    view: window
                });
                inputEvent._follower = true;
                eventInfo.target.dispatchEvent(inputEvent);
            }
        } else if (eventInfo.raw.type === 'mousedown') {
            if (dom.isFocusable(eventInfo.target)) {
                isFollowerFocusEvent = true;
                eventInfo.target.focus();
                isFollowerFocusEvent = false;
            }

            // Dispatch mouseup event
            var mouseupEvent = new MouseEvent('mouseup', eventInfo.raw);
            mouseupEvent._follower = true;
            eventInfo.target.dispatchEvent(mouseupEvent);

            // Dispatch click event
            var clickEvent = new MouseEvent('click', eventInfo.raw);
            clickEvent._follower = true;
            eventInfo.target.dispatchEvent(clickEvent);
        }
    }
}

module.exports = {
    create: function (controller, policy, disable, broadcast) {
        return this.instance = new EventMonitor(controller, policy, disable, broadcast);
    },
    instance: null
};
