var fs = require("fs");
var path = require("path");
var fileSystemService = require("./fileSystemService");

function chutzpahWalk(dir) {
    if (!fs.statSync(dir).isDirectory()) {
        dir = path.dirname(dir);
    }

    var results = [];
    var list = fs.readdirSync(dir);
    list.forEach(function (file) {
        file = path.join(dir, file);
        var stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            /* Recurse into a subdirectory */
            results = results.concat(chutzpahWalk(file));
        } else {
            /* Is a file */
            if (file.toLowerCase().endsWith("chutzpah.json")) {
                results.push(file);
            }
        }
    });
    return results;
}

module.exports = {
    walk: chutzpahWalk,
};

if (require.main === module) {
    // First two are always "Node" and the path to what was called.
    // Trash those.
    const myArgs = process.argv.slice(2);
    console.log("myArgs: ", myArgs);

    fileSystemService
        .getFileContents("C:\\temp\\chutzpahTestValues.json")
        .then(function (jsonContents) {
            var chutzpahTestValues = JSON.parse(jsonContents);

            var results = chutzpahWalk(chutzpahTestValues.chutzpahWalkStart);
            console.log(results);
        });
}
