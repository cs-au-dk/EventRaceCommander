module.exports = function (policy, api, catalogue, queries) {
    policy.add(catalogue.postponeWhileLoading(queries.menuHover, queries.DOMContentLoaded, null, { shouldBlock: true }));
};
