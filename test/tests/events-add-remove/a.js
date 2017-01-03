function log(msg) {
    document.getElementById('log').appendChild(
            document.createTextNode(msg + '\n'));
}

function handler1() {
    log("handler1");
}

function handler2() {
    log("handler2");
}

function handler3() {
    log("handler3");
}

function handler4() {
    log("handler4");
}

function late() {
    log("late");
}

// Adding event listener twice and removing it once => not called
document.getElementById('img1').addEventListener('load', handler1, false);
document.getElementById('img1').addEventListener('load', handler1, false);
document.getElementById('img1').removeEventListener('load', handler1, false);

// Adding event listener twice => called once
document.getElementById('img2').addEventListener('load', handler2, false);
document.getElementById('img2').addEventListener('load', handler2, false);

// Adding event listener and removing it => not called
document.getElementById('img1').onload = handler3;
document.getElementById('img1').onload = null;

// Adding event listener => called once
document.getElementById('img2').onload = handler4;
