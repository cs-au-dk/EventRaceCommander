module.exports = function (policy, api) {
    policy.allowPostponingSyncScripts = true;
    policy.add(api.Query('ready', 1).oid('XHR', 1).before(
        api.Query('execute', 1).oid('script', 2)));
};
