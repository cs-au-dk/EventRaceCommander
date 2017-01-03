// Controller
window.$_C = {
    assign: function (base, offset, val) {
        return base[offset] = val;
    }
};

// API
window.$_L = {
    Event: {
        next: function () {}
    }
};

// Monitor
window.$_M = {
    onEvent: function (eventInfo, listener, receiver) {
        if (listener) {
            listener.call(receiver);
        }
    }
};

// Shadowing
window.$_S = {
    OID: function () {}
};
