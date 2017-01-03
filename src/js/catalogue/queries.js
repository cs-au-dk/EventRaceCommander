var Q = require('../analysis/api.js').Query;

var queries = exports;

// An operation predicate that matches any XHR request
queries.ajaxRequest = Q('request').target('XHR');

// An operation predicate that matches any asynchronous (external) script request
queries.asyncScriptRequest = Q('request', null, { async: true, inline: false }).target('script');

// An operation predicate that matches any external script request
queries.externalScriptRequest = Q('request', null, { inline: false }).target('script');

// An operation predicate that matches any synchronous, external script request
queries.externalSyncScriptRequest = Q('request', null, { async: false, inline: false }).target('script');

// An operation predicate that matches any (synchronous) inline script request
queries.inlineScriptRequest = Q('request', null, { inline: true }).target('script');

// An operation predicate that matches any script request
queries.scriptRequest = Q('request').target('script');

// An operation predicate that matches any network request due to XHR or script loading
queries.networkRequest = queries.ajaxRequest.or(queries.externalScriptRequest);

// An operation predicate that matches any image request
queries.imgRequest = Q('request').target('img');

// An operation predicate that matches any iframe or image request
queries.resourceRequest = Q('request').target('img, iframe');

// An operation predicate that matches any timeout request
queries.timeoutRequest = Q('timeout_request').target('window');

// An operation predicate that matches any timeout request that is shorter than 1000 ms,
// and is not registered inside a timer event
queries.smallNonRecursiveTimeoutRequest = Q('timeout_request').target('window').metadata(function (metadata) {
	return typeof metadata.delay === 'number' && metadata.delay <= 1000 &&
		(metadata.parentEvent === null || metadata.parentEvent.name !== 'timeout_response');
});

// An operation predicate that matches the DOMContentLoaded event
queries.DOMContentLoaded = Q('DOMContentLoaded').target('document');

// An operation predicate that matches the load events on the document and window
queries.windowLoaded = Q('load').target('document, window');

// An operation predicate that matches anchor and button clicks
queries.anchorButtonClick = Q('mousedown').target('a, button, a > span');

// An operation predicate that matches form focus
queries.formFocus = Q('mousedown').target('input');

// An operation predicate that matches form input
queries.formInput = Q('keydown').target('input');

// An operation predicate that matches menu hover
queries.menuHover = Q('mouseover').target('li > a');

// An operation predicate that matches mousedown
queries.mousedown = Q('mousedown');

// An operation predicate that matches user events
queries.userEvent = Q('click focus href mousedown mouseup keydown keypress keyup');
