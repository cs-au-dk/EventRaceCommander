module.exports = function (policy, api, catalogue, queries) {
    var selector = 'button.js-flyout-toggle.dropdown';
    policy.add(api.Query('mousedown').target(selector).postpone(function () {
        var allButton = document.querySelector(selector);
        return allButton && allButton.getAttribute('aria-expanded');
    }));
};
