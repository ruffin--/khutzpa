const fs = require("fs");
const path = require("path");
const fileSystemService = require("./fileSystemService");
const utils = require("../helpers/utils");

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
    utils.logit("myArgs: ", myArgs);

    fileSystemService
        .getFileContents("C:\\temp\\chutzpahTestValues.json")
        .then(function (jsonContents) {
            try {
                var chutzpahTestValues = JSON.parse(jsonContents);

                if (!chutzpahTestValues.chutzpahWalkStart) {
                    console.warn("Invalid chutzpahWalkStart path");
                } else {
                    utils.logit("Starting at: " + chutzpahTestValues.chutzpahWalkStart);
                    var results = chutzpahWalk(chutzpahTestValues.chutzpahWalkStart);
                    utils.logit("x:asjson,tofile", results);
                }
            } catch (e) {
                console.error(
                    "Was unable to run chutzpahWalk's test/main logic",
                    jsonContents,
                    e
                );
            }
        });
}
