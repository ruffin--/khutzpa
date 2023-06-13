const fs = require("fs");
const fsPromises = require("fs").promises;
const nodePath = require("node:path");

const strman = require("../helpers/stringManipulation");

// mostly https://stackoverflow.com/a/56188301/1028230
function sniffEncoding(filePath) {
    /*eslint-disable new-cap */
    var d = new Buffer.alloc(5, [0, 0, 0, 0, 0]);
    /*eslint-enable new-cap */
    var fd = fs.openSync(filePath, "r");
    fs.readSync(fd, d, 0, 5, 0);
    fs.closeSync(fd);

    // If clear UTF16 BOM, then display as
    /* eslint-disable indent */
    var encodingValue =
        d[0] === 0xfe && d[1] === 0xff
            ? "utf16be"
            : d[0] === 0xff && d[1] === 0xfe
            ? "utf16le"
            : "utf8";
    /* eslint-enable indent */

    return {
        value: encodingValue,
        bom: encodingValue === "utf8" && d[0] === 0xef && d[1] === 0xbb && d[2] === 0xbf,
    };
}

function getFileContents(filePath) {
    var encoding = sniffEncoding(filePath);
    return fsPromises.readFile(filePath, encoding.value).then(function (contents) {
        contents =
            encoding.bom && encoding.value === "utf8"
                ? contents.replace(/^\uFEFF/, "")
                : contents;

        // remove inline comments so that it's json, not jsonc.
        return strman.stripInlineComments(contents);
    });
}

function getAllFilePaths(dirPath, arrayOfFiles) {
    var files = fs.readdirSync(dirPath);

    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function (file) {
        var fullPath = nodePath.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFilePaths(fullPath, arrayOfFiles);
        } else {
            arrayOfFiles.push(fullPath);
        }
    });

    return arrayOfFiles;
}

function filterNonexistentPaths(fullPaths, type) {
    type = type || "References";

    return fullPaths.filter((fullPath) => {
        if (!fullPath.toLowerCase().startsWith("http") && !fs.existsSync(fullPath)) {
            console.warn(
                `#### File listed in Chutzpah config's ${type} does not exist!
${fullPath}`
            );
            return false;
        }

        return true;
    });
}

module.exports = {
    getAllFilePaths,
    getFileContents,
    filterNonexistentPaths,
};
