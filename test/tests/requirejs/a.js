requirejs(["b.js?delay=1000"], function(b) {
    document.getElementById("b").addEventListener('click', b.log.bind(null, 'CLICK'), false);
});
