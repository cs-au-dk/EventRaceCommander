window.namespace = "__uv_"; // write to sessionState

function track(key, action) {
    document.getElementById('log').appendChild(
        document.createTextNode(window.namespace + '.' + key + ' = ' + action + '\n'));
}
