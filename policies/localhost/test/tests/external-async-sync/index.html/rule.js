module.exports = function (policy, api, catalogue, queries) {
    policy.add(catalogue.postponeResponsesWhileLoadingStaticScripts(queries.asyncScriptRequest));
};
