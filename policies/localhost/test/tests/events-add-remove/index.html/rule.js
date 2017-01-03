module.exports = function (policy, api, catalogue, queries) {
    policy.add(
        catalogue.fifo(queries.imgRequest),
        catalogue.postponeResponsesWhileLoadingStaticScripts(queries.imgRequest));
};
