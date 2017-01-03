module.exports = function (policy, api, catalogue, queries) {
	var query = api.Query('request', null, { async: true, inline: false }).target('script').metadata(function (metadata) {
		if (!metadata || !metadata.url) return;
		if (metadata.url.indexOf('s-code-contents-65778bc202aa3fe01113e6b6ea6d103eda099fe5.js') >= 0)
			return true;
		if (metadata.url.indexOf('satellite-567046aa64746d0712008241.js') >= 0)
			return true;
		if (metadata.url.indexOf('satellite-567046aa64746d0712008254.js') >= 0)
			return true;
	});
	policy.add(catalogue.fifo(query));
};
