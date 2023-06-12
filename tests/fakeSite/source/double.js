window.double = function (x) {
    var parsed = parseInt(x, 10);

    return parsed || parsed === 0 ? x * 2 : x;
};
