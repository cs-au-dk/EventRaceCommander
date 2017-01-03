// This is a high risk race, since the event handler registration
// occurs in an external script
img1.addEventListener("load", function () {
    console.log('img1.onload');
}, false);

function clickHandler() {
    console.log('img1.onclick');
}

var messages = {
    onload: 'img2.onload'
};
