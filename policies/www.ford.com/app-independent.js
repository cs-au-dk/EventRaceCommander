module.exports = function (policy, api, catalogue, queries) {
    policy.add(catalogue.postponeWhileLoading(queries.formFocus, queries.windowLoaded));
};
