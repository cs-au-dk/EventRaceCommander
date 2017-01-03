module.exports = function (policy, api, catalogue, queries) {
    policy.add(
    	catalogue.postponeWhileLoading(queries.formInput),
    	catalogue.postponeWhileLoading(queries.anchorButtonClick, queries.DOMContentLoaded, queries.networkRequest));
};
