var api = require('./api.js');
var happensBefore = require('./happens-before.js');
var utils = require('../utils/utils.js');

var permittedUserEvents = ['mouseenter', 'mouseover', 'mouseout'];

// If eventInfo is passed, inserts immediately after eventInfo, or in the front
// if eventInfo is not found in the buffer
function bufferUserEvent(buffer, newEventInfo, eventInfo) {
    var waiting = [];
    var item = {
        decision: utils.eventify({
            shouldBlock: false,
            shouldPostpone: true,
            startBlocking: function (eventInfo) {
                if (waiting.indexOf(eventInfo) >= 0) {
                    return false;
                }
                waiting.push(eventInfo);
                return true;
            },
            toString: function () {
                return 'POSTPONE UNTIL DISPATCHED ' + newEventInfo.toString();
            }
        }),
        eventInfo: newEventInfo
    };
    if (eventInfo) {
        var pos = 0;
        for (var i = 0; i < buffer.length; ++i) {
            if (eventInfo === buffer[i].eventInfo) {
                pos = i+1;
                break;
            }
        }
        buffer.splice(pos, 0, item);
    } else {
        for (var i = 0; i < buffer.length; ++i) {
            if (buffer[i].eventInfo.id == newEventInfo.id) {
                utils.debug('User input already in buffer:', newEventInfo.id);
                return;
            }
        }
        buffer.push(item);
    }
}

function Policy(options) {
    this.allowPostponingSyncScripts = false;
    this.observers = (options && options.observers) || [];
    this.rules = (options && options.rules) || [];
    this.userEventBuffer = [];

    utils.eventify(this);
}

Policy.prototype.add = function (o) {
    if (arguments.length > 1) {
        for (var i = 0; i < arguments.length; ++i) {
            this.add(arguments[i]);
        }
    } else if (o instanceof api.Observer) {
        this.observers.push(o);
    } else if (o instanceof api.Rule) {
        this.rules.push(o);
    } else {
        if (o.observers) {
            Array.prototype.push.apply(this.observers, o.observers);
        }
        if (o.rules) {
            Array.prototype.push.apply(this.rules, o.rules);
        }
    }
};

Policy.prototype.ensureImmediatelyAfter = function (eventInfo, newEventInfo) {
    bufferUserEvent(this.userEventBuffer, newEventInfo, eventInfo);
};

Policy.prototype.eventEmitted = function (/*Event*/ eventInfo, broadcast) {
    if (broadcast) {
        this.trigger('emit', eventInfo);
    }

    happensBefore.eventEmitted(eventInfo, this);

    // Only rules receive notifications on eventEmitted
    for (var i = 0; i < this.rules.length; ++i) {
        this.rules[i].eventEmitted(eventInfo);
    }
};

Policy.prototype.eventDispatched = function (/*Event*/ eventInfo, broadcast) {
    if (broadcast) {
        this.trigger('dispatch', eventInfo);
    }

    if (utils.isUserEventName(eventInfo.name) && this.userEventBuffer.length) {
        var head = this.userEventBuffer[0];
        if (eventInfo.equals(head.eventInfo)) {
            head.decision.trigger('resolve');
            this.userEventBuffer.shift();

            if (!this.observers.length && !this.rules.length && !this.userEventBuffer.length) {
                this.trigger('resolve');
            }
        }
    }

    happensBefore.eventDispatched(eventInfo);

    if (this.rules.length || this.observers.length) {
        for (var i = this.rules.length-1; i >= 0; --i) {
            var rule = this.rules[i];
            if (rule.eventDispatched(eventInfo)) {
                // The rule has been resolved and should be removed from the policy
                this.rules.splice(i, 1);
            }
        }

        for (var i = this.observers.length-1; i >= 0; --i) {
            var observer = this.observers[i];
            if (observer.eventDispatched(eventInfo, this)) {
                // The observer has been resolved and should be removed from the policy
                this.observers.splice(i, 1);
            }
        }

        if (!this.observers.length && !this.rules.length) {
            if (!this.userEventBuffer.length) {
                this.trigger('resolve');
            }
        }
    }
};

Policy.prototype.eventPostponed = function (/*Event*/ eventInfo, broadcast) {
    if (broadcast) {
        this.trigger('postpone', eventInfo);
    }
};

/**
 * returns { feedback: bool, shouldBlock: bool, shouldPostpone: bool, toString: () => String }
 */
Policy.prototype.delayDispatch = function (/*Event*/ eventInfo, /*Rule*/ ignore) {
    var decision;

    if (utils.isUserEventName(eventInfo.name) && permittedUserEvents.indexOf(eventInfo.name) < 0 && this.userEventBuffer.length) {
        var head = this.userEventBuffer[0];
        if (!eventInfo.equals(head.eventInfo)) {
            decision = head.decision;
        }
    }

    if (!decision) {
        for (var i = 0; i < this.rules.length; ++i) {
            var rule = this.rules[i];
            if (rule !== ignore && this.rules[i].delayDispatch(eventInfo, ignore)) {
                decision = this.rules[i];
                break;
            }
        }

        if (!decision) {
            decision = happensBefore.delayDispatch(eventInfo);
        } 
    }

    if (decision && decision.shouldPostpone && utils.isUserEventName(eventInfo.name) && !eventInfo.raw._info) {
        bufferUserEvent(this.userEventBuffer, eventInfo);
    }

    return decision;
};

module.exports = Policy;
