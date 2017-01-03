module.exports = function (policy, api, catalogue, queries) {
    policy.add(
        catalogue.postponeWhileLoading(queries.formInput.or(queries.mousedown)),
        catalogue.fifo(queries.asyncScriptRequest));
};
