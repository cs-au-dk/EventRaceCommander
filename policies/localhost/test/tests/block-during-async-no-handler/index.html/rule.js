module.exports = function (policy, api, catalogue, queries) {
    policy.add(catalogue.postponeWhileLoading(queries.userEvent), catalogue.postponeWhileAsync(queries.userEvent));
};
