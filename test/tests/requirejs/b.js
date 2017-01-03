define(function() {
    return {
        log: function (msg) {
            document.getElementById('log').appendChild(
                document.createTextNode(msg + '\n'));
        }
    };
});
