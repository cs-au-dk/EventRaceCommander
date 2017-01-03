var dom = require('./dom.js');
var natives = require('./natives.js');

var oids = {};
var shadows = new Map();

function getShadow(o) {
    var shadow = shadows.get(o);
    if (!shadow) {
        var oid, allocName;
        if (o instanceof natives.types.Element) {
            if (o.dataset && o.dataset.id) {
                oid = new OID(dom.extractTagName(o.tagName), parseInt(o.dataset.id));
            } else {
                allocName = dom.extractTagName(o.tagName);
            }
        } else if (o instanceof natives.types.XMLHttpRequest) {
            allocName = 'XHR';
        } else if (o === window) {
            allocName = 'window';
        } else if (o === document) {
            allocName = 'document';
        } else {
            throw new Error('Unexpected');
        }
        shadow = {
            oid: oid || new OID(allocName)
        };
        shadows.set(o, shadow);
    }
    return shadow;
}

function OID(name, num) {
    if (typeof num === 'undefined') {
        num = oids[name] = (oids[name] || 0) + 1;
    }

    this.id = name + '#' + num;
    this.name = name;
    this.num = num;
}

OID.prototype.matches = function (/*OID*/ other) {
    return (!this.name || this.name === other.name) &&
        (!this.num || this.num === other.num);
};

OID.prototype.equals = function (other) {
    return other instanceof OID &&
        this.name === other.name &&
        this.num === other.num;
};

function getOID(o) {
    return getShadow(o).oid;
}

function setOIDs(o) {
    for (var key in o) {
        if (o.hasOwnProperty(key)) {
            oids[key] = o[key];
        }
    }
}

module.exports = {
	getShadow: getShadow,
	getOID: getOID,
	OID: OID,
    setOIDs: setOIDs
};
