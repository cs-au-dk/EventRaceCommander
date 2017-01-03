var natives = require('./natives.js');

function extractTagName(tagNameNS) {
    tagNameNS = tagNameNS.toLowerCase();
    var idx = tagNameNS.indexOf(':');
    return idx >= 0 ? tagNameNS.substring(idx+1) : tagNameNS;
}

function isFocusable(o) {
    if (o instanceof natives.types.Element) {
        var tagName = extractTagName(o.tagName);
        return tagName === 'input' || tagName === 'select' || tagName === 'textarea';
    }
    return false;
}

module.exports = {
	extractTagName: extractTagName,
	isFocusable: isFocusable
};
