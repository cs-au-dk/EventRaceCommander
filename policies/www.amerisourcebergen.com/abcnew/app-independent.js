module.exports = function (policy, api, catalogue, queries) {
    policy.add(catalogue.postponeWhileLoading(api.Query('mousedown')), catalogue.postponeWhileLoading(queries.formInput));
};
