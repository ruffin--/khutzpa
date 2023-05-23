const nodePath = require("node:path");

function findTheRoot(files) {
    const re = /\.\.[/\\]/g;

    if (!Array.isArray(files) && !files.length) {
        throw "can't find the root; ain't an array or is empty";
    }

    var possibleRoot = nodePath.dirname(files[0]);

    files.forEach((file) => {
        var fileParent = nodePath.dirname(file);
        var dirDiff = nodePath.relative(possibleRoot, fileParent);
        console.log(dirDiff);

        if (dirDiff.startsWith("..")) {
            var backupCount = (dirDiff.match(re) || []).length;
            for (var i = 0; i < backupCount; i++) {
                possibleRoot = nodePath.dirname(possibleRoot);
            }
            console.log("NEW ROOT: " + possibleRoot);
        }
    });

    return possibleRoot;
}

if (require.main === module) {
    // First two are always "Node" and the path to what was called.
    // Trash those.
    const myArgs = process.argv.slice(2);
    console.log("myArgs: ", myArgs);

    var files = [
        "/a/b/c/d/1.html",
        "/a/b/c/d/e/2.html",
        "/a/b/c/3.html",
        "/a/b/4.html",
        "/a/b/c/5.html",
    ];

    var result = findTheRoot(files);
    console.log(result);
}

module.exports = {
    findTheRoot,
};
