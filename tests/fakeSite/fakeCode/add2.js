window.add2 = function (x) {
    var parsed = parseInt(x, 10);

    return parsed || parsed === 0 ? x + 2 : x;
};

window.add2broken = function (x) {
    var parsed = parseInt(x, 10);

    return parsed || parsed === 0 ? x + 22 : x;
};
