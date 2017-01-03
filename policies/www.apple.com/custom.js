module.exports = function (policy, api, catalogue, queries) {
    policy.add(catalogue.postponeWhileLoading(api.Query('mousedown').target('.ac-gn-link-search, .ac-gn-link-bag')));
};
