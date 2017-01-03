module.exports = function (policy, api, catalogue, queries) {
    policy.add(catalogue.postponeWhileLoading(
    	api.Query('mousedown').target('a, button, a > img, a > span').or(
			api.Query('keydown').target('input'))));
};
