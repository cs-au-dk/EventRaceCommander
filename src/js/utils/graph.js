function Graph() {
    this.preds = new Map();
    this.succs = new Map();
}

Graph.prototype.addEdge = function (from, to) {
    var preds = this.preds.get(to), succs = this.succs.get(from);
    if (preds) {
        preds.push(from);
    } else {
        this.preds.set(to, [from]);
    }
    if (succs) {
        succs.push(to);
    } else {
        this.succs.set(from, [to]);
    }
};

// Assumes the edge exists
Graph.prototype.removeEdge = function (from, to) {
    var preds = this.preds.get(to), succs = this.succs.get(from);
    if (preds) {
        preds.splice(preds.indexOf(from), 1);
        if (!preds.length) {
            this.preds.delete(to);
        }
    }
    if (succs) {
        succs.splice(succs.indexOf(to), 1);
        if (!succs.length) {
            this.succs.delete(from);
        }
    }
};

Graph.prototype.removeNodeAndEdges = function (node) {
    var preds = this.preds.get(node) || [], succs = this.succs.get(node) || [];
    for (var i = preds.length-1; i >= 0; --i) {
        this.removeEdge(preds[i], node);
    }
    for (var i = succs.length-1; i >= 0; --i) {
        this.removeEdge(node, succs[i]);
    }
};

Graph.prototype.isConnected = function (from, to) {
    var succs = this.succs.get(from);
    var worklist = succs ? succs.slice(0) : [];
    var visited = new Map();
    visited.set(from, true);

    while (worklist.length) {
        from = worklist.shift();
        if (from === to) {
            return true;
        }
        succs = this.succs[from] || [];
        for (var i = 0, n = succs.length; i < n; ++i) {
            var succ = succs[i];
            if (!visited.get(succ)) {
                worklist.push(succ);
            }
        }
    }
};

module.exports = Graph;
