var dom = require('./dom.js');
var shadowing = require('./shadowing.js');

var eventHandlerAttributes = ['abort', 'afterprint', 'beforeprint',
    'beforeunload', 'blur', 'change', 'click', 'contextmenu',
    'copy', 'cut', 'dblclick', 'drag', 'dragend', 'dragenter',
    'dragleave', 'dragover', 'dragstart', 'drop', 'error',
    'focus', 'hashchange', 'input', 'invalid', 'keydown', 'keypress',
    'keyup', 'load', 'message', 'mousedown', 'mouseenter',
    'mouseleave', 'mousemove', 'mouseout', 'mouseover',
    'mouseup', 'mousewheel', 'offline', 'online', 'pagehide',
    'pageshow', 'paste', 'popstate', 'readystatechange', 'reset',
    'resize', 'scroll', 'search', 'select', 'show', 'storage',
    'submit', 'toggle', 'touchstart', 'unload', 'wheel'];

var userEventNames = {
    focus: true,
    click: true,
    href: true,
    keydown: true,
    keypress: true,
    keyup: true,
    change: true,
    blur: true,
    mousedown: true,
    mouseover: true,
    mouseup: true
    // ...
};

var xhrEventNames = ['not_initialized', 'established', 'received', 'processing', 'ready'];
exports.xhrEventNames = xhrEventNames;

function augmentScriptUrl(url, allocNum) {
    return augmentUrl(url, { name: 'allocNum', value: allocNum.toString() });
}
exports.augmentScriptUrl = augmentScriptUrl;

function augmentUrl(url, params) {
    var hash = '';
    var hashIdx = url.indexOf('#');
    if (hashIdx >= 0) {
        hash = url.substring(hashIdx);
        url = url.substring(0, hashIdx);
    }
    var query = [];
    (params instanceof Array ? params : [params]).forEach(function (param) {
        if (url.indexOf(param.name + '=') < 0) {
            query.push(param.name + '=' + param.value);
        }
    });
    if (!query.length) return url;
    query = query.join('&');
    if (url.indexOf('?') >= 0) {
        url += '&' + query + hash;
    } else {
        url += '?' + query + hash;
    }
    return url;
}
exports.augmentUrl = augmentUrl;

function augmentUrlsInHtml(html) {
    var injectedScripts = [];
    return {
        injectedScripts: injectedScripts,
        html: html.toString().replace(/<(iframe|script)[^>]*\ssrc=('[^']*'|"[^"]*")[^>]*>/g, function (element, tagName, src) {
            tagName = dom.extractTagName(tagName);
            var oid = new shadowing.OID(tagName);

            var realSrc = src.substring(1, src.length-1); // remove quotes
            var newSrc = realSrc;

            if (tagName === 'iframe') {
                if (realSrc.trim() && !realSrc.match(/^javascript:/i)) {
                    newSrc = augmentUrl(realSrc, { name: 'instr', value: '0' });
                }
            } else if (tagName === 'script') {
                newSrc = augmentScriptUrl(realSrc, oid.num);

                // Emit script request event
                injectedScripts.push({
                    oid: oid,
                    metadata: {
                        async: element.indexOf('async') >= 0,
                        defer: element.indexOf('defer') >= 0,
                        inline: false,
                        url: newSrc
                    }
                });
            }

            // Change source and inject data-id attribute
            var idx = element.indexOf(src);
            return element.substring(0, idx+1) +
                newSrc + element.substring(idx+src.length-1, idx+src.length) +
                ' data-id="' + oid.num + '"' +
                element.substring(idx+src.length);
        })
    };
}
exports.augmentUrlsInHtml = augmentUrlsInHtml;

exports.debug = function () {
    var args = Array.prototype.slice.call(arguments);
    if (typeof args[0] === 'string') {
        args[0] = 'ERC: ' + args[0];
    } else {
        args.unshift('ERC:');
    }

    var last = args[args.length-1];
    var debugging = false, kind = last instanceof Object ? last.kind : null;
    try { debugging = window.location.hash.indexOf('debug') >= 0; } catch (e) {}
    if (debugging && !kind) {
        console.log.apply(console, args);
    } else if (kind) {
        args.pop();
        (kind === 'error' ? console.error : console.info).apply(console, args);
    }
};

function deleteAtCursor(input, forward) {
     if (input.type.toLowerCase() === 'email') {
        // The selectionStart and selectionEnd properties are not supported
        // on email fields (throws exception); change momentarily to 'text' :-)
        var type = input.type;
        input.type = 'text';
        deleteAtCursor(input, forward);
        input.type = type;
    } else if (input.selectionStart || input.selectionStart === '0') {
        var start = input.selectionStart, end = input.selectionEnd;
        if (input.selectionStart !== input.selectionEnd) {
            // Delete selected
        } else if (forward) {
            end = input.selectionStart+1;
        } else {
            start = input.selectionStart-1;
        }
        input.value = input.value.substring(0, start)
            + input.value.substring(end, input.value.length);
        input.selectionStart = input.selectionEnd = start;
    }
}
exports.deleteAtCursor = deleteAtCursor;

exports.eventify = function (o) {
    var _eventify = {};

    o.on = function (type, listener, condition) {
        var listeners = _eventify[type];
        if (listeners) {
            listeners.push({ listener: listener, condition: condition });
        } else {
            _eventify[type] = [{ listener: listener, condition: condition }];
        }
        return this;
    };

    o.once = function (type, listener, condition) {
        o.on(type, function f() {
            listener.apply(o, arguments);
            o.off(type, f);
        }, condition);
        return this;
    };

    o.off = function (type, listener) {
        var listeners = _eventify[type];
        if (listeners) {
            for (var i = 0, n = listeners.length; i < n; i++) {
                if (listener === listeners[i].listener) {
                    listeners.splice(i, 1);
                    break;
                }
            }
        }
        return this;
    };

    o.trigger = function (type, arg) {
        var listeners = _eventify[type];
        if (listeners) {
            for (var i = listeners.length - 1; i >= 0; i--) {
                var listener = listeners[i];
                if (!listener.condition || listener.condition.call(o, arg)) {
                    listener.listener.call(o, arg);
                }
            }
        }
        return this;
    };

    return o;
};

exports.extend = function (o, other) {
    if (!o) return other;
    for (var key in other) {
        if (other.hasOwnProperty(key)) {
            o[key] = other[key];
        }
    }
    return o;
};

exports.getEvtNameFromAttrName = function (attrName) {
    if (attrName.substring(0, 2) === 'on') {
        return attrName.substring(2);
    }
    return attrName;
};

exports.getResponseEventName = function (o) {
    if (o instanceof window.Element) {
        var tagName = dom.extractTagName(o.tagName);
        if (tagName === 'img' || tagName === 'link') {
            return 'load';
        }
        if (tagName === 'script') {
            return 'execute';
        }
    }
    if (o instanceof window.XMLHttpRequest) {
        return 'ready';
    }
};

function insertAtCursor(input, val) {
    if (document.selection) {
        if (!input.matches || !input.matches(':focus')) {
            input.focus();
        }
        var sel = document.selection.createRange();
        sel.text = val;
    } else if (input.type.toLowerCase() === 'email') {
        // The selectionStart and selectionEnd properties are not supported
        // on email fields (throws exception); change momentarily to 'text' :-)
        var type = input.type;
        input.type = 'text';
        insertAtCursor(input, val);
        input.type = type;
    } else if (input.selectionStart || input.selectionStart == '0') {
        var start = input.selectionStart, end = input.selectionEnd;
        input.value = input.value.substring(0, start) + val
            + input.value.substring(end, input.value.length);
        input.selectionStart = input.selectionEnd = start + val.length;
    } else {
        input.value += val;
    }
}
exports.insertAtCursor = insertAtCursor;

function isUserEventName(name) {
    return userEventNames[name];
}
exports.isUserEventName = isUserEventName;
