var shadowing = require('../utils/shadowing.js');
var utils = require('../utils/utils.js');

function Rule() {
    utils.eventify(this);
    this.bindings = {};

    this.once('resolve', function () {
        utils.debug('RESOLVED', this);
    });
}

Rule.prototype.eventEmitted = function (/*Event*/ e) {
};

function BeforeRule(/*Query*/ fst, /*Query*/ snd, /*Object*/ options) {
    Rule.call(this);

    options = options || {};
    if (!options.shouldBlock && !options.shouldPostpone) {
        options.shouldPostpone = true;
    }

    this.fst = fst;
    this.snd = snd;
    this.feedback = options.feedback;
    this.shouldBlock = options.shouldBlock;
    this.shouldPostpone = options.shouldPostpone;
    this.waiting = [];
}

BeforeRule.prototype = new Rule();

BeforeRule.prototype.eventEmitted = function (/*Event*/ e) {
    if (!this.bindings.fst && this.fst.matches(e)) {
        this.bindings.fst = e;
    }
};

// Delay snd if fst has not been seen yet
BeforeRule.prototype.delayDispatch = function (/*Event*/ e) {
    return this.snd.matches(e) && !e.equals(this.bindings.fst);
};

// OK when fst has been observed
BeforeRule.prototype.eventDispatched = function (/*Event*/ e) {
    if (this.bindings.fst ? this.bindings.fst.equals(e) : this.fst.matches(e)) {
        this.trigger('resolve');

        // Return true to indicate that the rule has been resolved
        return true;
    }
};

BeforeRule.prototype.startBlocking = function (eventInfo) {
    if (this.waiting.indexOf(eventInfo) >= 0) {
        return false;
    }
    this.waiting.push(eventInfo);
    return true;
};

BeforeRule.prototype.toString = function () {
    return [this.shouldBlock ? 'BLOCK' : 'POSTPONE', 'UNTIL', this.fst.toString(), '<', this.snd.toString()].join(' ');
};

function ConditionalRule(/*Query*/ query, /*Function*/ condition, /*Object*/ options) {
    Rule.call(this);

    options = options || {};
    if (!options.shouldBlock && !options.shouldPostpone) {
        options.shouldPostpone = true;
    }

    this.query = query;
    this.condition = condition;
    this.shouldBlock = options.shouldBlock;
    this.shouldPostpone = options.shouldPostpone;
    this.waiting = [];
}

ConditionalRule.prototype = new Rule();

ConditionalRule.prototype.delayDispatch = function (/*Event*/ e) {
    return this.query.matches(e);
};

// OK when fst has been observed
ConditionalRule.prototype.eventDispatched = function (/*Event*/ e) {
    if (this.condition(e)) {
        this.trigger('resolve');

        // Return true to indicate that the rule has been resolved
        return true;
    }
};

ConditionalRule.prototype.startBlocking = function (eventInfo) {
    if (this.waiting.indexOf(eventInfo) >= 0) {
        return false;
    }
    this.waiting.push(eventInfo);
    return true;
};

ConditionalRule.prototype.toString = function () {
    return [this.shouldBlock ? 'BLOCK' : 'POSTPONE', 'UNTIL CONDITION'].join(' ');
};

/**
 * For every event that matches the query,
 * creates a new rule using the generator function.
 */
function Observer(/*Object*/ options) {
    Rule.call(this);

    this.bind = options.bind;
    this.query = options.query;
    this.fork = options.fork;
    this.expired = options.expired;
}

Observer.prototype = new Rule();

// Fork a new rule if the event matches the query.
Observer.prototype.eventDispatched = function (/*Event*/ e, /*Policy*/ p) {
    if (this.query.matches(e)) {
        var action = this.fork(e);
        if (action) {
            if (action instanceof BeforeRule) {
                utils.debug('FORK', action.fst.toString(), '<', action.snd.toString());
            } else {
                utils.debug('FORK', action);
            }
            p.add(action);
        }
    }

    if (this.expired && this.expired.call(this, e)) {
        utils.debug('EXPIRED', this);
        return true;
    }
};

/**
 * A concrete, fully qualified event that occurred at runtime.
 */
function Event(oid, name, num, raw, metadata) {
    this.id = oid.id + '_' + name + '_#' + num;
    this.oid = oid;
    this.name = name;
    this.num = num;
    this.raw = raw;
    this.metadata = metadata;
}

Event.evtCounter = {};

Event._get = function (inc, assign, oid, name, raw, metadata) {
    var key = oid.id + '_' + name;
    var num = (Event.evtCounter[key] || 0) + inc;
    if (assign) {
        Event.evtCounter[key] = num;
    }
    return new Event(oid, name, num, raw, metadata);
};

Event.next = Event._get.bind(Event, 1, true);
Event.peek = Event._get.bind(Event, 1, false);
Event.current = Event._get.bind(Event, 0, false);

Event.executionOf = function (/*Event*/ evt) {
    switch (evt.oid.name) {
        case 'script':
            return new FirstMatchQuery(evt.oid, 'execute', evt.num);
    }
    throw new Error('Unexpected');
};

Event.responseOf = function (/*Event*/ evt) {
    switch (evt.oid.name) {
        case 'iframe':
        case 'img':
        case 'script':
            return new FirstMatchQuery(evt.oid, 'error load', evt.num);
        case 'XHR':
            return new FirstMatchQuery(evt.oid, 'ready', evt.num);
        case 'window':
            if (evt.name === 'timeout_request') {
                return new ResponseQuery(evt);
            }
    }
    throw new Error('Unexpected');
};

Event.prototype.correspondingQuery = function () {
    return new FirstMatchQuery(this.oid, this.name, this.num);
};

Event.prototype.equals = function (/*Event*/ other) {
    return other instanceof Event &&
        this.oid.equals(other.oid) &&
        this.name === other.name &&
        this.num === other.num;
};

/**
 * A type, Query, useful for performing runtime type checks.
 */
function Query(oid, name, num, metadata) {
    if (arguments.length) {
        return new FirstMatchQuery(oid, name, num, metadata);
    }
}

Query.prototype.or = function (other) {
    return new DisjunctiveQuery(this, other);
};

Query.prototype.before = function (other, options) {
    return new BeforeRule(this, other, options);
};

Query.prototype.block = function (condition) {
    return new ConditionalRule(this, condition, { shouldBlock: true });
};

Query.prototype.postpone = function (condition) {
    return new ConditionalRule(this, condition);
};

function DisjunctiveQuery(q1, q2) {
    Query.call(this);

    this.q1 = q1;
    this.q2 = q2;
}

DisjunctiveQuery.prototype = new Query();

DisjunctiveQuery.prototype.matches = function (/*Event*/ evt) {
    return this.q1.matches(evt) || this.q2.matches(evt);
};

DisjunctiveQuery.prototype.toString = function () {
    return this.q1.toString() + 'v' + this.q2.toString();
};

function ResponseQuery(evt) {
    Query.call(this);

    this.evt = evt;
}

ResponseQuery.prototype = new Query();

ResponseQuery.prototype.matches = function (/*Event*/ evt) {
    return this.evt === evt.reqEventId;
};

ResponseQuery.prototype.toString = function () {
    return 'response(' + this.evt.id + ')';
};

/**
 * A query, which unlike Event, does not need to be fully qualified.
 * The result of the query is the first event that matches the query.
 */
function FirstMatchQuery(oid, name, num, metadata) {
    if (typeof oid === 'string') {
        return new FirstMatchQuery(null, oid, name, num);
    }

    Query.call(this);

    this._oid = oid;
    this.name = name;
    this.num = num;
    this._metadata = metadata;

    this._names = null;
    this._target = null;

    if (name) {
        this._names = {};
        var names = name.split(' ');
        for (var i = 0; i < names.length; ++i) {
            this._names[names[i]] = true;
        }
    }
}

FirstMatchQuery.prototype = new Query();

FirstMatchQuery.prototype.oid = function (name, num) {
    this._oid = name instanceof shadowing.OID ? name : new shadowing.OID(name, num);
    return this;
};

FirstMatchQuery.prototype.target = function (target) {
    this._target = target;
    return this;
};

FirstMatchQuery.prototype.metadata = function (metadata) {
    this._metadata = metadata;
    return this;
};

FirstMatchQuery.prototype.matches = function (/*Event*/ evt) {
    var match = (!this._oid || this._oid.matches(evt.oid)) &&
        (!this.name || this._names[evt.name]) &&
        (!this.num || this.num === evt.num);
    if (!match) {
        return false;
    }
    if (this._metadata) {
        // If the event has no metadata then no match
        if (!evt.metadata) {
            return false;
        }
        // If the query's metadata object is a function, then let the
        // function determine if there is a match
        if (typeof this._metadata === 'function') {
            if (!this._metadata(evt.metadata)) {
                return false;
            }
        } else {
            // Otherwise for each property check if there is a match
            for (var key in this._metadata) {
                // If the property is a function, then let the
                // function determine if there is a match, otherwise
                // check if the values are identical
                if (typeof this._metadata[key] === 'function') {
                    if (!this._metadata[key](evt.metadata[key])) {
                        return false;
                    }
                } else if (this._metadata[key] !== evt.metadata[key]) {
                    return false;
                }
            }
        }
    }
    if (this._target) {
        if (evt.raw) {
            var target = evt.raw.target || (evt.raw.path.length && evt.raw.path[0]);
            if (target === document || target === window) {
                var name = target === document ? 'document' : 'window';
                var targets = this._target.split(',').map(function (target) {
                    return target.trim();
                });
                if (targets.indexOf(name) < 0) {
                    return false;
                }
            } else if (target instanceof window.Element && !target.matches(this._target)) {
                return false;
            }
        } else {
            // Check that there is an exact match with the OID
            var targets = this._target.split(',').map(function (target) {
                return target.trim();
            });
            if (targets.indexOf(evt.oid.name) < 0) {
                return false;
            }
        }
    }
    return true;
};

// Question marks are placeholders
FirstMatchQuery.prototype.toString = function () {
    return (this._oid ? ((this._oid.name || '?') + '#' + (this._oid.num || '?')) : '?') + '_' + (this.name || '?') + '_#' + (this.num || '?');
};

module.exports = {
    Observer: Observer,
    Event: Event,
    Query: Query,
    Rule: Rule
};
