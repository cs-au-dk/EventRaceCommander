module.exports = function (policy, api, catalogue, queries) {
    policy.add(
    	catalogue.postponeResponsesWhileLoading(queries.imgRequest),
    	catalogue.fifo(queries.imgRequest));
};
