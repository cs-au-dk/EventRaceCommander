module.exports = function (policy, api, catalogue, queries) {
    policy.add(catalogue.postponeWhileLoading(api.Query('keydown'), queries.DOMContentLoaded, queries.timeoutRequest));
};
