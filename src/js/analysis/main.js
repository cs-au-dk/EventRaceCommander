module.exports = function (disable, broadcast) {
    if (window.$_M) {
        // Analysis is already installed in the global scope
    } else {
        window.$_L = require('./api.js');
        window.$_C = require('./controller.js');
        window.$_M = function (init) {
            var Policy = require('./policy.js');
            init(window.$_P = new Policy(), $_L, require('../catalogue/policies.js'), require('../catalogue/queries.js'));
            var monitor = require('./monitor.js');
            window.$_M = monitor.create($_C, $_P, disable, broadcast);
        };
        window.$_S = require('../utils/shadowing.js');
    }
};
