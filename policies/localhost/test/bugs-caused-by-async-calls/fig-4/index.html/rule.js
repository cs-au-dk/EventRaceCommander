module.exports = function (policy, api, catalogue, queries) {
    policy.add(catalogue.postponeWhileAsync(queries.userEvent, { shouldBlock: true }));
};
