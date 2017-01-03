if (typeof window === 'undefined') {
    // Never used when not run in the browser
    return;
}

var props = {
    clearTimeout: clearTimeout,
    setTimeout: setTimeout,
    document: {
        createElement: Document.prototype.createElement,
        write: Document.prototype.write,
        writeln: Document.prototype.writeln
    },
    Element: {
        insertAdjacentElement: Element.prototype.insertAdjacentElement,
        insertAdjacentHTML: Element.prototype.insertAdjacentHTML
    },
    Node: {
        appendChild: Node.prototype.appendChild,
        insertBefore: Node.prototype.insertBefore,
        replaceChild: Node.prototype.replaceChild
    },
    XMLHttpRequest: {
        open: XMLHttpRequest.prototype.open,
        send: XMLHttpRequest.prototype.send
    }
};

var types = {
    Document: Document,
    Element: Element,
    Node: Node,
    Window: Window,
    XMLHttpRequest: XMLHttpRequest
};

function restore() {
    window.clearTimeout = props.clearTimeout;
    window.setTimeout = props.setTimeout;

    types.Document.prototype.write = props.document.write;
    types.Document.prototype.writeln = props.document.writeln;
    types.Element.prototype.insertAdjacentHTML = props.Element.insertAdjacentHTML;
    types.Element.prototype.insertAdjacentElement = props.Element.insertAdjacentElement;
    types.Node.prototype.appendChild = props.Node.appendChild;
    types.Node.prototype.insertBefore = props.Node.insertBefore;
    types.Node.prototype.replaceChild = props.Node.replaceChild;
    types.XMLHttpRequest.prototype.open = props.XMLHttpRequest.open;
    types.XMLHttpRequest.prototype.send = props.XMLHttpRequest.send;
}

module.exports = {
    props: props,
    restore: restore,
    types: types
};
