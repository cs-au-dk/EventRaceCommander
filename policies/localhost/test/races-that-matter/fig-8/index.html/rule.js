module.exports = function (policy, api, catalogue, queries) {
    policy.add(catalogue.networkFifo());
};
