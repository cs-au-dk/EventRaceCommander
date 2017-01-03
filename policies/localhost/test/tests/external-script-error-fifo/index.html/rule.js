module.exports = function (policy, api, catalogue, queries) {
	policy.allowPostponingSyncScripts = true;
    policy.add(catalogue.fifo(queries.scriptRequest));
};
