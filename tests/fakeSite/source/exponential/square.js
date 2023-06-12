window.square = function (x) {
    var parsed = parseInt(x, 10);

    return parsed || parsed === 0 ? x * x : x;
};

window.dumbSquare = function (x) {
    for (var i = 0; i < x; i++) {
        x += x;
    }
    return x;
};
