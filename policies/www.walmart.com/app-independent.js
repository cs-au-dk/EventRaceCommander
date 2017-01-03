module.exports = function (policy, api, catalogue, queries) {
    policy.add(
        catalogue.postponeWhileLoading(
        	Q('mousedown').target('a, button, a > img, a > span').or(
				Q('keydown').target('input')),
        	queries.windowLoaded,
            queries.networkRequest.or(queries.smallNonRecursiveTimeoutRequest)));
};
