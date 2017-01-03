var api = require('./api.js');
var dom = require('../utils/dom.js');
var monitor = require('./monitor.js');
var natives = require('../utils/natives.js');
var shadowing = require('../utils/shadowing.js');
var utils = require('../utils/utils.js');

function EventController() {
    var currentEvent = null;
    var disabled = false;
    var self = this;
    var timeouts = {};

    // Intercept when script tags are injected dynamically
    Document.prototype.write = interceptDocumentWrite(natives.props.document.write);
    Document.prototype.writeln = interceptDocumentWrite(natives.props.document.writeln);
    Element.prototype.insertAdjacentHTML = interceptDocumentWrite(natives.props.Element.insertAdjacentHTML);
    Element.prototype.insertAdjacentElement = interceptElementInsert(natives.props.Element.insertAdjacentElement);
    Node.prototype.appendChild = interceptElementInsert(natives.props.Node.appendChild);
    Node.prototype.insertBefore = interceptElementInsert(natives.props.Node.insertBefore);
    Node.prototype.replaceChild = interceptElementInsert(natives.props.Node.replaceChild);

    // Intercept timeouts
    window.setTimeout = function (listener, delay, postpone) {
            if (typeof listener !== 'function') listener = eval.bind(window, listener);
            if (!delay) delay = 0;

            var shadow = shadowing.getShadow(this);
            var reqEventId = api.Event.next(shadow.oid, 'timeout_request', null, { delay: delay, parentEvent: currentEvent });

            // Emit timeout request event to monitor
            monitor.instance.onEvent(reqEventId);

            var newListener = function () {
                var resEventId = api.Event.next(shadow.oid, 'timeout_response', null, { delay: reqEventId.metadata.delay, requestId: reqEventId.num });
                resEventId.reqEventId = reqEventId;
                monitor.instance.onEvent(resEventId, function () {
                    currentEvent = resEventId;
                    try {
                        listener.call(this);
                    } finally {
                        currentEvent = null;
                    }
                }, this);
            };
            var id = natives.props.setTimeout.call(this, newListener, delay, postpone);
            timeouts[id] = reqEventId;
            return id;
    };

    window.clearTimeout = function (id) {
        var reqEventId = timeouts[id];
        if (reqEventId) {
            delete timeouts[id];
            var resEventId = api.Event.next(reqEventId.oid, 'timeout_response');
            resEventId.reqEventId = reqEventId;
            monitor.instance.onEvent(resEventId);
        }
        return natives.props.clearTimeout.call(this, id);
    };

    // Intercept Ajax requests
    XMLHttpRequest.prototype.open = function (method, url, async) {
        // Avoid instrumenting HTML that has been loaded dynamically using AJAX
        // since it may collide with the main page's monitor
        var newUrl = utils.augmentUrl(url, { name: 'instr', value: '0' });

        var shadow = shadowing.getShadow(this);
        shadow.method = method;
        shadow.url = newUrl;
        shadow.async = async;

        return natives.props.XMLHttpRequest.open.call(this, method, newUrl, async);
    };

    XMLHttpRequest.prototype.send = function () {
        var shadow = shadowing.getShadow(this);
        if (shadow.async) {
            monitor.instance.onEvent(api.Event.next(shadow.oid, 'request', null, null, {
                async: true,
                method: shadow.method,
                url: shadow.url
            }));
            if (!this.onerror) {
                // Setup an event handler for 'onreadystatechange', otherwise the event
                // will be lost if the client code does not register an event handler
                self.assign(this, 'onerror', defaultAjaxResponseHandler);
            }
            if (!this.onload && !this.onreadystatechange) {
                // Setup an event handler for 'onreadystatechange', otherwise the event
                // will be lost if the client code does not register an event handler
                self.assign(this, 'onreadystatechange', defaultAjaxResponseHandler);
            }
        }
        return natives.props.XMLHttpRequest.send.apply(this, arguments);
    };

    // Intercept property assignments
    this.assign = function (base, offset, val) {
        var result = val;

        if (base instanceof natives.types.Element) {
            var shadow = shadowing.getShadow(base);
            switch (offset) {
                case 'innerHTML':
                    result = utils.augmentUrlsInHtml(val).html;

                case 'src':
                    var tagName = dom.extractTagName(base.tagName);
                    if (tagName === 'iframe' || tagName === 'img') {
                        monitor.instance.onEvent(api.Event.next(shadow.oid, 'request', null,
                            this, false));
                    }
                    break;
            }
        }

        if (base instanceof natives.types.XMLHttpRequest) {
            var shadow = shadowing.getShadow(base);
            switch (offset) {
                case 'onabort':
                case 'onerror':
                    result = function () {
                        // Capture the readyState on base, it may change when we start delaying the event!
                        monitor.instance.onEvent(api.Event.next(shadow.oid, offset.substring(2)), function () {
                            if (val) {
                                val.apply(base, arguments);
                            }
                        }, this);
                    };
                    break;

                case 'onload':
                case 'onreadystatechange':
                    if (offset === 'onload' && this.onreadystatechange === defaultAjaxResponseHandler && val) {
                        // Avoid issuing two 'ready' events due to default handler (defaultAjaxResponseHandler)
                        this.onreadystatechange = null;
                    }

                    result = function () {
                        // Capture the readyState on base, it may change when we start delaying the event!
                        var readyState = base.readyState;
                        var eventName = utils.xhrEventNames[readyState];
                        monitor.instance.onEvent(api.Event.next(shadow.oid, eventName), function () {
                            // Fictively update the readyState on the XHR object,
                            // while we are calling the handler function
                            var currentReadyState = base.readyState;
                            base.readyState = readyState;

                            if (val) {
                                val.apply(base, arguments);
                            }

                            // Update the readyState to the actual one (it cannot have changed in the meantime,
                            // since we are single-threaded)
                            base.readyState = currentReadyState;
                        }, this);
                    };
                    break;
            }
        }

        base[offset] = result;
        return val;
    };

    this.disable = function () {
        this.assign = function (base, offset, val) {
            return base[offset] = val;
        };
        natives.restore();
        disabled = true;
    };

    this.isDisabled = function () {
        return disabled;
    };
}

function defaultAjaxResponseHandler() {}

function interceptDocumentWrite(f) {
    return function () {
        var htmlIdx = f === natives.props.Element.insertAdjacentHTML ? 1 : 0;
        
        // Augment HTML
        var augmentation = utils.augmentUrlsInHtml(arguments[htmlIdx]);

        // Insert HTML
        arguments[htmlIdx] = augmentation.html;

        // Inject script requests
        if (f === natives.props.document.write || f === natives.props.document.writeln) {
            for (var i = 0; i < augmentation.injectedScripts.length; ++i) {
                var injectedScript = augmentation.injectedScripts[i];
                var metadata = utils.extend({ injected: true }, injectedScript.metadata);
                natives.props.document.write.call(document, [
                    "<script data-generated=\"true\">",
                    "$_M.onEvent($_L.Event.next(new $_S.OID('script', " + injectedScript.oid.num + "), 'request', null, ",
                    JSON.stringify(metadata),
                    "));",
                    "<", "/", "script>"
                ].join(''));
            }
        } else {
            utils.debug('Should emit a script request event from ELEMENT_INSERT_ADJACENT_HTML');
        }

        return f.apply(this, arguments);
    };
}

function interceptElementInsert(f) {
    return function () {
        var elementIdx = f === natives.props.Element.insertAdjacentElement ? 1 : 0;
        var newNode = arguments[elementIdx];
        if (newNode instanceof natives.types.Element) {
            var tagName = dom.extractTagName(newNode.tagName), src = newNode.src;
            if (tagName === 'iframe') {
                if (src.trim() && !src.match(/^javascript:/i)) {
                    newNode.src = utils.augmentUrl(src, { name: 'instr', value: '0' });
                }
            } else if (tagName === 'script' && newNode.src) {
                var shadow = shadowing.getShadow(newNode);
                newNode.src = utils.augmentScriptUrl(src, shadow.oid.num);

                var requestScript = natives.props.document.createElement.call(document, 'script');
                requestScript.async = false;
                requestScript.dataset.generated = 'true';
                requestScript.innerHTML = [
                    "$_M.onEvent($_L.Event.next(new $_S.OID('script', " + shadow.oid.num + "), 'request', null, ",
                    JSON.stringify({
                        async: newNode.async,
                        defer: newNode.defer,
                        injected: true,
                        inline: false,
                        url: newNode.src
                    }),
                    "));",
                ].join('');

                // Inject script request
                arguments[elementIdx] = requestScript;
                f.apply(this, arguments);

                // Inject the script itself
                var parentIdx = -1;
                for (var i = 0; i < requestScript.parentNode.childNodes.length; ++i) {
                    if (requestScript.parentNode.childNodes[i] === requestScript) {
                        parentIdx = i;
                        break;
                    }
                }

                if (parentIdx === requestScript.parentNode.childNodes.length-1) {
                    natives.props.Node.appendChild.call(requestScript.parentNode, newNode);
                } else {
                    natives.props.Node.insertBefore.call(requestScript.parentNode, newNode, requestScript.parentNode.childNodes[parentIdx+1]);
                }

                return newNode;
            }
        }
        return f.apply(this, arguments);
    };
}

module.exports = new EventController();
