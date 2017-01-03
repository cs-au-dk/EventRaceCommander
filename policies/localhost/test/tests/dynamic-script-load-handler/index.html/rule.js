module.exports = function (policy, api, catalogue, queries) {
    policy.add(
        catalogue.postponeWhileLoading(queries.userEvent, queries.DOMContentLoaded, queries.networkRequest),
        catalogue.networkFifo());
};
