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
document.getElementById('b1').addEventListener('click', handler1, false);
document.getElementById('b1').addEventListener('click', handler1, false);
document.getElementById('b1').removeEventListener('click', handler1, false);

// Adding event listener twice => called once
document.getElementById('b2').addEventListener('click', handler2, false);
document.getElementById('b2').addEventListener('click', handler2, false);

// Adding event listener and removing it => not called
document.getElementById('b1').onclick = handler3;
document.getElementById('b1').onclick = null;

// Adding event listener => called once
document.getElementById('b2').onclick = handler4;

// Removing event listener => not called
document.getElementById('b4').onclick = null;
