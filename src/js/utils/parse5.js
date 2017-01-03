var parse5 = require('parse5');
var treeAdapter = parse5.treeAdapters.default;

function createElement(name, options) {
    var attrs = options instanceof Array ? options : ((options || {}).attrs || []);
    var node = treeAdapter.createElement(name, undefined, attrs);
    if (typeof options !== 'undefined') {
        var text = typeof options === 'object' ? options.text : options;
        if (typeof text === 'string') {
            treeAdapter.insertText(node, text);
        }
    }
    return node;
}

function getAttribute(node, name) {
    var attrs = node.attrs || [];
    for (var i = 0, n = attrs.length; i < n; i++) {
        var attr = attrs[i];
        if (attr.name === name) {
            return attr;
        }
    }
}

function appendChild(node, newNode) {
    treeAdapter.appendChild(node, newNode);
    return newNode;
}

function insertBefore(node, newNode, position) {
    treeAdapter.insertBefore(node, newNode, position);
    return newNode;
}

function prependChild(node, newNode, options) {
    if (typeof newNode === 'string') {
        newNode = createElement(newNode, options);
    }

    if (node.childNodes.length) {
        treeAdapter.insertBefore(node, newNode, node.childNodes[0]);
    } else {
        treeAdapter.appendChild(node, newNode);
    }

    return newNode;
}

module.exports = {
    appendChild: appendChild,
    createElement: createElement,
    getAttribute: getAttribute,
    insertBefore: insertBefore,
    prependChild: prependChild
};
