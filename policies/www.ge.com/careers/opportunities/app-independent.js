module.exports = function (policy, api, catalogue, queries) {
    policy.add(catalogue.postponeWhileLoading(queries.mousedown, queries.DOMContentLoaded, queries.ajaxRequest, { shouldBlock: true }));
};
