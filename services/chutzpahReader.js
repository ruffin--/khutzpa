/* eslint-disable quotes */
const fs = require("fs");
const fsPromises = require("fs").promises;
const minimatch = require("minimatch");
// NOTE: node:path requires node v16+
const nodePath = require("node:path");
const Os = require("os");

const isWindows = Os.platform() === "win32";
console.log("isWindows? " + isWindows);

function findChutzpahJson(startPath) {
    if (!fs.existsSync(startPath)) {
        throw `Invalid start path: ${startPath}`;
    }

    // ????: Should we care about other types? Should we
    // be ready for any extension? This is kinda offensively programmed.
    var possibleDir = startPath.toLowerCase().endsWith(".js")
        ? nodePath.dirname(startPath)
        : startPath;

    var foundChutzpahJson = undefined;
    while (!foundChutzpahJson) {
        console.log("checking: " + possibleDir);
        var tryHere = nodePath.join(possibleDir, "Chutzpah.json");
        if (fs.existsSync(tryHere)) {
            foundChutzpahJson = tryHere;
        } else {
            var newPossibleDir = nodePath.dirname(possibleDir);
            if (newPossibleDir === possibleDir) {
                throw `No Chutzpah.json file found in same dir or parent: ${startPath}`;
            }
            possibleDir = newPossibleDir;
            // console.log("Next dir up: " + possibleDir);
        }
    }

    return foundChutzpahJson;
}

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

        return contents.replace(/\/\/.*[\r\n]+/g, "");
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

// Looks like I might need to keep track of platform (Windows vs. *NIX)
function handleChutzpahSelector(selector, jsonFileParent) {
    console.log({ title: "handleChutzpahSelector", selector, jsonFileParent });

    if (!selector.Path) {
        selector.Path = jsonFileParent;
    }

    var selectorFullPath =
        selector.Path.startsWith(jsonFileParent) || selector.Path.startsWith("*")
            ? selector.Path
            : nodePath.join(jsonFileParent, selector.Path);

    if (fs.existsSync(selectorFullPath)) {
        var theseFiles;
        var pathIsDir = fs.statSync(selectorFullPath).isDirectory();

        if (pathIsDir) {
            // Taking off the trailing "/" so that when we use it to replace
            // full paths, the relative paths still start with /
            // That's wack for single files, but we have a fix for that coming...
            if (selectorFullPath.endsWith("/") || selectorFullPath.endsWith("\\")) {
                selectorFullPath = selectorFullPath.substring(
                    0,
                    selectorFullPath.length - 1
                );
            }
            theseFiles = getAllFilePaths(selectorFullPath);

            // TODO: Do I need to do this?
            theseFiles = theseFiles || [];

            // When we minimatch, we want to do it relative to the parent
            // path.
            // Otherwise "*.js" will never match anything, since we
            // have full paths in the getAllFilePaths results.
            theseFiles = theseFiles.map((x) => x.replace(selectorFullPath, ""));
        } else {
            // I'm not sure how to handle single files in the root.
            // Seems they should start with `/` to match the logic.
            // But I could see doing it either way.
            // Probably is minimatch acts differently with each, though
            // they're functionally equivalent.
            // TODO: Windows solution
            // Let's be offensive for now:
            if (!selector.Path.startsWith("/")) {
                throw `Paths must start with /
    ---- #${selector.Path}#`;
            }
            theseFiles = [selector.Path];
        }

        theseFiles = theseFiles || [];

        console.log(`all files for ${selectorFullPath}`, theseFiles);

        // TODO: The Chutzpah docs say these are both plural,
        // but I'm seeing json files with, eg, Include instead of
        // Includes.
        // https://github.com/mmanela/chutzpah/wiki/references-setting
        // I'm not supporting both. Is that smart?
        //
        // Also, if a selector doesn't exist, should we return everything?
        // (Probably so? Maybe not? That's what we're doing now.)
        if (selector.Include && !selector.Includes) {
            selector.Includes = selector.Include;
        }

        if (!selector.Includes) {
            selector.Includes = [];
        }
        if (!Array.isArray(selector.Includes)) {
            selector.Includes = [selector.Includes];
        }

        // Trying to solve the minimatch starting slash issue.
        // TODO: You may also need to solve the asterisk interpretation issue.
        // https://github.com/mmanela/chutzpah/wiki/tests-setting#example
        // { "Includes": ["*test1*"] },
        // "Includes all tests that contain test1 in its path. This is in glob format."
        //  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        // If that's accurate, that's not how minimatch works.
        selector.Includes.forEach(function (includePattern) {
            var noSlashTheseFiles = theseFiles.map((x) => x.substring(1));

            // returns [] if no matches
            // https://github.com/isaacs/minimatch#nonull
            theseFiles = minimatch.match(
                includePattern.startsWith("/") ? theseFiles : noSlashTheseFiles,
                includePattern
            );
        });

        if (selector.Exclude && !selector.Excludes) {
            selector.Excludes = selector.Exclude;
        }

        if (!selector.Excludes) {
            selector.Excludes = [];
        }
        if (!Array.isArray(selector.Excludes)) {
            selector.Excludes = [selector.Excludes];
        }

        selector.Excludes.forEach(
            (excludePattern) =>
                (theseFiles = theseFiles.filter(
                    (path) => !minimatch(path, excludePattern)
                ))
        );

        if (pathIsDir) {
            // Now let's put the full paths back (we'll remove the original
            // root directory before we write to an html file).
            theseFiles = theseFiles.map((x) =>
                isWindows
                    ? `${selectorFullPath}${x.startsWith("\\") ? x : "\\" + x}`
                    : `${selectorFullPath}${x.startsWith("/") ? x : "/" + x}`
            );
        } else {
            // we still want a full path, so append the root to single
            // file selectors.
            theseFiles = theseFiles.map((x) => jsonFileParent + x);
        }

        return theseFiles;
    }

    console.log(`${selectorFullPath} from json does not exist`);
    return [];
}

function filterNonexistentPaths(fullPaths, type) {
    type = type || "References";

    return fullPaths.filter((fullPath) => {
        if (!fs.existsSync(fullPath)) {
            console.warn(
                `#### File listed in Chutzpah config's ${type} does not exist!
${fullPath}`
            );
            return false;
        }

        return true;
    });
}

// var jsonFilePath = "./testChutzpah.json";

function getConfigInfo(originalTestPath) {
    var configFilePath = findChutzpahJson(originalTestPath);

    if (!configFilePath) {
        throw "invalid/empty config file";
    }

    if (configFilePath.startsWith(".")) {
        throw (
            "Path to Chutzpah.json must be absolute. This starts with a dot: " +
            configFilePath
        );
    }

    console.log("Reading Chutzpah config: " + configFilePath);
    var jsonFilePath = nodePath.normalize(configFilePath);
    var jsonFileParent = nodePath.dirname(jsonFilePath);

    var singleTestFile =
        originalTestPath.lastIndexOf(".") >
        (isWindows
            ? originalTestPath.lastIndexOf("/")
            : originalTestPath.lastIndexOf("\\"))
            ? originalTestPath
            : false;

    // If you execute from an "inner" directory, don't include test files
    // outside of that path. (*DO* include all ref files, though.)
    var limitingDir = singleTestFile
        ? nodePath.dirname(originalTestPath)
        : originalTestPath;

    return getFileContents(jsonFilePath).then(function (chutzpahJson) {
        var chutzpahConfigObj = JSON.parse(chutzpahJson);
        console.log("read chutzpah json", chutzpahConfigObj);

        var allRefFilePaths = [];
        chutzpahConfigObj.References.forEach(function (ref) {
            allRefFilePaths = allRefFilePaths.concat(
                handleChutzpahSelector(ref, jsonFileParent)
            );
        });

        // ensure they all exist
        allRefFilePaths = filterNonexistentPaths(allRefFilePaths, "References");

        var specFiles = [];
        if (!singleTestFile) {
            chutzpahConfigObj.Tests.forEach(function (ref) {
                specFiles = specFiles.concat(handleChutzpahSelector(ref, jsonFileParent));
            });
        } else {
            // var parentAtStart = `^${jsonFileParent}`;
            // var reParentAtStart = new RegExp(parentAtStart, "i");
            // var singleFileWithParentRemoved = singleTestFile.replace(reParentAtStart, "");
            // specFiles = [singleFileWithParentRemoved];
            specFiles = [singleTestFile];
        }

        specFiles = filterNonexistentPaths(specFiles, "Test (spec files)");

        if (!specFiles.length) {
            throw "No files to test! " + JSON.stringify(chutzpahConfigObj.Tests);
        }

        // Chutzpah doesn't seem to make a distinction between what should be referenced
        // and what should be tested -- or, more specifically, you can ref tests without
        // causing an issue (I think?).
        // Let's remove any test files from our ref files so they're not duplicated.
        // (I mean, I guess it'd work with them, but you get the point.)
        allRefFilePaths = allRefFilePaths.filter(
            (path) => specFiles.indexOf(path) === -1
        );

        var coverageFiles = [];

        if (Array.isArray(chutzpahConfigObj.CodeCoverageIncludes)) {
            chutzpahConfigObj.CodeCoverageIncludes.forEach((coverageIncludePattern) => {
                if (!isWindows) {
                    coverageIncludePattern = coverageIncludePattern.replace(/\\/g, "/");
                }

                console.log(
                    coverageIncludePattern,
                    minimatch.match(allRefFilePaths, coverageIncludePattern)
                );
                coverageFiles = coverageFiles.concat(
                    minimatch.match(allRefFilePaths, coverageIncludePattern)
                );
            });
        }

        return {
            originalTestPath,
            configFilePath,
            jsonFileParent,
            allRefFilePaths,
            specFiles,
            coverageFiles,
        };
    });
}

module.exports = {
    getConfigInfo,
    findChutzpahJson, // okay, this is just here for testing. That's bad.
};
