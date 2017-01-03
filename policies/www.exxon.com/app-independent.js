module.exports = function (policy, api, catalogue, queries) {
    policy.add(
    	catalogue.postponeWhileLoading(queries.anchorButtonClick),
    	catalogue.postponeResponsesWhileLoading(queries.resourceRequest));
};
