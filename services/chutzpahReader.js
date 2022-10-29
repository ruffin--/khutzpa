/* eslint-disable quotes */
const fs = require("fs");
const minimatch = require("minimatch");
// NOTE: node:path requires node v16+
const nodePath = require("node:path");
const Os = require("os");
const fileSystemService = require("./fileSystemService");
const manip = require("./stringManipulationService");

// const { config } = require("process");

const isWindows = Os.platform() === "win32";
console.log("isWindows? " + isWindows);
const slash = isWindows ? "\\" : "/";

var selectorUtils = {
    findAllIncludes: function (selector, theseFiles) {
        var allMatches = [];

        selectorUtils.cleanIncludes(selector);

        console.log("includes", selector.Includes);

        // TODO: You may also need to solve the asterisk interpretation issue.
        // https://github.com/mmanela/chutzpah/wiki/tests-setting#example
        // { "Includes": ["*test1*"] },
        // "Includes all tests that contain test1 in its path. This is in glob format."
        //  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        // If that's accurate, that's not how globs in minimatch work.
        //
        // Below: Trying to solve the minimatch starting slash issue.
        selector.Includes.forEach(function (includePattern) {
            // if the pattern doesn't have a leading slash but our files do,
            // that's an issue. remove them for the comparison and then...
            // put them back?
            var withSlashes = [];
            var noSlashesForComparison = [];
            if (!manip.startsWithSlash(includePattern)) {
                withSlashes = theseFiles.filter((x) => manip.startsWithSlash(x));
                noSlashesForComparison = manip.removeLeadingSlashes(withSlashes);
            }

            // minimatch.match returns [] if no matches
            // https://github.com/isaacs/minimatch#nonull
            var matches = minimatch.match(
                // if the include pattern doesn't have a leading slash,
                // remove any leading slash from the files being compared
                // too
                !manip.startsWithSlash(includePattern)
                    ? manip.removeLeadingSlashes(theseFiles)
                    : theseFiles,
                includePattern
            );

            // Ok, if we stripped a leading slash, put it back. Inefficient, but computers
            // love doing this stuff. Right?
            matches = matches.map((x) => {
                var index = noSlashesForComparison.indexOf(x);
                // Yes, there are side effects. Yes, that's smelly, but also gets us around
                // the "what if I have `spam.txt` AND `/spam.txt` issue?
                if (index > -1) {
                    var ret = withSlashes[index];
                    noSlashesForComparison.splice(index, 1);
                    withSlashes.splice(index, 1);
                    return ret;
                }

                return x;
            });

            // I feel like this is a painfully inefficient operation.
            allMatches = allMatches.concat(
                matches.filter((x) => allMatches.indexOf(x) === -1)
            );
        });

        return allMatches;
    },

    cleanExcludes: function (selector) {
        if (selector.Exclude && !selector.Excludes) {
            selector.Excludes = selector.Exclude;
        }

        if (!selector.Excludes) {
            selector.Excludes = [];
        }
        if (!Array.isArray(selector.Excludes)) {
            selector.Excludes = [selector.Excludes];
        }
    },

    cleanIncludes: function (selector) {
        // TODO: The Chutzpah docs say these are both plural,
        // but I'm seeing json files with, eg, Include instead of
        // Includes.
        // https://github.com/mmanela/chutzpah/wiki/references-setting
        // I'm not supporting both; this privileges Include singular over
        // Includes plural, erasing plural if singular exists. Is that smart?
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
    },

    removeAllExcludes: function (selector, theseFiles) {
        selectorUtils.cleanExcludes(selector);

        console.log("Excludes", selector.Excludes);

        selector.Excludes.forEach(
            (excludePattern) =>
                (theseFiles = theseFiles.filter(
                    (path) => !minimatch(path, excludePattern)
                ))
        );

        return theseFiles;
    },
};

function mergeAndDedupe(parentCollection, newFiles) {
    // let's standardize on *NIX paths.
    // TODO: I think there's a node function for this.
    newFiles.forEach((x, i) => (newFiles[i] = x.replace(/\\/g, "/")));
    var filesForSelectorDeduped = newFiles.filter(
        (x) => parentCollection.indexOf(x) === -1
    );

    return parentCollection.concat(filesForSelectorDeduped);
}

function handleChutzpahSelector(selector, jsonFileParent, type, nth) {
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
            theseFiles = fileSystemService.getAllFilePaths(selectorFullPath);

            // TODO: Do I need to do this?
            theseFiles = theseFiles || [];

            // When we minimatch, we want to do it relative to the parent
            // path.
            // Otherwise "*.js" will never match anything, since we
            // have full paths in the getAllFilePaths results.
            theseFiles = theseFiles.map((x) => x.replace(selectorFullPath, ""));

            theseFiles = theseFiles || [];

            console.log(`all files for ${nth}th ${type} selector before filtering: 
    ${selectorFullPath}
${JSON.stringify(theseFiles, null, "  ")}

`);

            theseFiles = selectorUtils.findAllIncludes(selector, theseFiles);
            theseFiles = selectorUtils.removeAllExcludes(selector, theseFiles);

            // Now let's put the full paths back (we'll remove the original
            // root directory before we write to an html file).
            theseFiles = theseFiles.map((x) =>
                isWindows
                    ? `${selectorFullPath}${x.startsWith("\\") ? x : "\\" + x}`
                    : `${selectorFullPath}${x.startsWith("/") ? x : "/" + x}`
            );

            console.log(`and after filtering:
            ${JSON.stringify(theseFiles, null, "  ")}
                        
`);
        } else {
            // I'm not sure how to handle single files in the root.
            // Seems they should start with `/` to match the logic.
            // But I could see doing it either way.
            // Problem is minimatch acts differently with each, though
            // they're functionally equivalent.
            //
            // TODO: Windows solution
            // Let's be offensive for now:
            if (!selector.Path.startsWith("/")) {
                throw `Paths must start with / ---- #${selector.Path}#`;
            }

            theseFiles = [jsonFileParent + selector.Path];
        }

        return theseFiles;
    }

    console.log(`${selectorFullPath} from json does not exist`);
    return [];
}

function handleAggressiveStar(configInfo) {
    var ocdDryPropNames = ["References", "Tests"];
    var ocdDryArrayNames = ["Includes", "Excludes"];

    ocdDryPropNames.forEach(function (refsOrTests) {
        configInfo[refsOrTests] = Array.isArray(configInfo[refsOrTests])
            ? configInfo[refsOrTests]
            : [configInfo[refsOrTests]];

        configInfo[refsOrTests].forEach((singleEntry) => {
            selectorUtils.cleanIncludes(singleEntry);
            selectorUtils.cleanExcludes(singleEntry);

            ocdDryArrayNames.forEach((pathArrayName) => {
                // We don't require that there's an In/Excludes for a single file.
                if (singleEntry[pathArrayName]) {
                    singleEntry[pathArrayName] = Array.isArray(singleEntry[pathArrayName])
                        ? singleEntry[pathArrayName]
                        : [singleEntry[pathArrayName]];

                    var toAdd = [];
                    singleEntry[pathArrayName].forEach((singlePath) => {
                        if (singlePath.startsWith("*") && !singlePath.startsWith("**")) {
                            // AggressiveStar means a value of "*.js" looks for "*.js" in EVERY folder,
                            // recurisvely rather than simply at the root level folder.
                            // Some glob evaluators seem to do this and some don't. (???)
                            // TODO: Add github issue link.
                            var allFoldersSelector = "**/" + singlePath;
                            if (
                                !singleEntry[pathArrayName].find(
                                    (x) => x === allFoldersSelector
                                )
                            ) {
                                console.log(
                                    `GOING AGGRESSIVE!!! ${refsOrTests} - ${singlePath}`
                                );
                                toAdd.push(allFoldersSelector);
                            }
                        }
                    });

                    singleEntry[pathArrayName] = singleEntry[pathArrayName].concat(toAdd);
                }
            });
        });
    });
}

var re = /^\*\/|\/\*\/|\/\*$/g;
function starReplacer(match /*, p1, offset, original, group*/) {
    // I know, I could've done this less bullheadedly. This works.
    switch (match) {
        case "*/":
            return "**/";
        case "/*":
            return "/**";
        default:
            return "/**/";
    }
}

function coverageAggressiveStar(s) {
    return s.replace(re, starReplacer);
}

function parseChutzpahInfo(chutzpahConfigObj, jsonFileParent, singleTestFile) {
    if (chutzpahConfigObj.AggressiveStar) {
        handleAggressiveStar(chutzpahConfigObj);
    }

    var allRefFilePaths = [];

    chutzpahConfigObj.References.forEach(function (singleReferenceEntry, i) {
        var filesForSelector = handleChutzpahSelector(
            singleReferenceEntry,
            jsonFileParent,
            "Reference",
            i
        );

        allRefFilePaths = mergeAndDedupe(allRefFilePaths, filesForSelector);
    });

    // ensure they all exist
    // Looks like even full Windows paths work here with foreward slashes. Weird.
    allRefFilePaths = fileSystemService.filterNonexistentPaths(
        allRefFilePaths,
        "References"
    );
    allRefFilePaths = allRefFilePaths.map((x) =>
        x.replace(jsonFileParent.replace(/\\/g, "/"), "")
    );

    var specFiles = [];
    if (!singleTestFile) {
        chutzpahConfigObj.Tests.forEach(function (ref, i) {
            var filesForSelector = handleChutzpahSelector(ref, jsonFileParent, "Test", i);

            specFiles = mergeAndDedupe(specFiles, filesForSelector);
        });
    } else {
        // var parentAtStart = `^${jsonFileParent}`;
        // var reParentAtStart = new RegExp(parentAtStart, "i");
        // var singleFileWithParentRemoved = singleTestFile.replace(reParentAtStart, "");
        // specFiles = [singleFileWithParentRemoved];
        specFiles = [singleTestFile];
    }

    specFiles = fileSystemService.filterNonexistentPaths(specFiles, "Test (spec files)");
    specFiles = specFiles.map((x) => x.replace(jsonFileParent.replace(/\\/g, "/"), ""));

    if (!specFiles.length) {
        throw "No files to test! " + JSON.stringify(chutzpahConfigObj.Tests);
    }

    // Chutzpah doesn't seem to make a distinction between what should be referenced
    // and what should be tested -- or, more specifically, you can ref tests without
    // causing an issue (I think?).
    // Let's remove any test files from our ref files so they're not duplicated.
    // (I mean, I guess it'd work with them, but you get the point.)
    allRefFilePaths = allRefFilePaths.filter((path) => specFiles.indexOf(path) === -1);

    var coverageFiles = [];

    if (Array.isArray(chutzpahConfigObj.CodeCoverageIncludes)) {
        chutzpahConfigObj.CodeCoverageIncludes.forEach((coverageIncludePattern) => {
            // if (!isWindows) {
            coverageIncludePattern = coverageIncludePattern.replace(/\\/g, "/");
            // }

            if (chutzpahConfigObj.AggressiveStar) {
                coverageIncludePattern = coverageAggressiveStar(coverageIncludePattern);
            }

            coverageFiles = coverageFiles.concat(
                minimatch.match(allRefFilePaths, coverageIncludePattern)
            );

            console.log(coverageIncludePattern, coverageFiles);
        });
    }

    return {
        allRefFilePaths,
        specFiles,
        coverageFiles,
    };
}

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

    // TODO: Or just check if it ends with `.js` or `.ts`?
    var singleTestFile =
        fs.statSync(originalTestPath).isDirectory() &&
        originalTestPath.lastIndexOf(".") > originalTestPath.indexOf(slash) &&
        !originalTestPath.toLowerCase().endsWith("chutzpah.json")
            ? originalTestPath
            : false;

    // If you execute from an "inner" directory, don't include test files
    // outside of that path. (*DO* include all ref files, though.)
    var limitingDir = singleTestFile
        ? nodePath.dirname(originalTestPath)
        : originalTestPath;

    return fileSystemService.getFileContents(jsonFilePath).then(function (chutzpahJso) {
        var chutzpahConfigObj = JSON.parse(chutzpahJso);
        console.log("read chutzpah json", chutzpahConfigObj);

        var ret = parseChutzpahInfo(chutzpahConfigObj, jsonFileParent, singleTestFile);

        return {
            originalTestPath,
            configFilePath,
            jsonFileParent,
            allRefFilePaths: ret.allRefFilePaths,
            specFiles: ret.specFiles,
            coverageFiles: ret.coverageFiles,
        };
    });
}

module.exports = {
    getConfigInfo,
    findChutzpahJson, // okay, this is just here for testing. That's bad.
};
