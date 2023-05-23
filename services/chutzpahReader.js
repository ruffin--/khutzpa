/* eslint-disable quotes */
const fs = require("fs");
const minimatch = require("minimatch");
// NOTE: node:path requires node v16+
const nodePath = require("node:path");
const Os = require("os");
const fileSystemService = require("./fileSystemService");
const manip = require("../helpers/stringManipulation");
const utils = require("../helpers/utils");

// const { config } = require("process");

const isWindows = Os.platform() === "win32";
utils.debugLog("isWindows? " + isWindows);

// We have two competing issues here...
// A. *.js style globs only match files in the root dir.
// B. minimatch always fails to match ../s in paths.
//      https://github.com/isaacs/minimatch/issues/30#issuecomment-1040599045
//      (It looked like optimizationLevel:2 would change that, but it doesn't.)
//      (Appears that's b/c you're using v5, not v7+)
//      https://github.com/isaacs/minimatch/blob/main/changelog.md
// That means B. wants full paths, but A doesn't want a full path appended.
// That conflict makes it tough to use paths as single strings.
// Full path doesn't work A & B. Hacks are hard to match back up.
function hasRelativeOrFullPathMatch(fullPath, home, glob) {
    var relative = nodePath.relative(home, fullPath);
    var valueForDebugging = minimatch(relative, glob) || minimatch(fullPath, glob);

    console.log(`Match?
        ${home}
        ${fullPath}
        ${relative}
        ${glob}
        ${valueForDebugging}`);

    return valueForDebugging;
}

function minimatchEngine(selector, fullPaths, home, selectorName) {
    var allMatches = [];

    selectorName = selectorName || "Includes";

    // TODO: You may also need to solve the asterisk interpretation issue.
    // https://github.com/mmanela/chutzpah/wiki/tests-setting#example
    // { "Includes": ["*test1*"] },
    // "Includes all tests that contain test1 in its path. This is in glob format."
    //  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    // If that's accurate, that's not how globs in minimatch work.
    //
    // Below: Trying to solve the minimatch starting slash issue.
    selector[selectorName].forEach(function (includePattern) {
        // if the pattern doesn't have a leading slash but our files do,
        // that's an issue, since that seems to mean "root of *relative*
        // path to Chutzpah instead of root of file system to minimatch.
        // Then remember which paths were doctored and restore them after.
        var withSlashes = [];
        var noSlashesForComparison = [];
        if (!manip.startsWithSlash(includePattern)) {
            withSlashes = fullPaths.filter((x) => manip.startsWithSlash(x));
            noSlashesForComparison = manip.removeLeadingSlashes(withSlashes);
        }

        var matches = fullPaths.filter((singleFullPath) =>
            hasRelativeOrFullPathMatch(singleFullPath, home, includePattern)
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

        // I feel like this dedupe is a painfully inefficient operation.
        allMatches = allMatches.concat(
            matches.filter((x) => allMatches.indexOf(x) === -1)
        );
    });

    return allMatches;
}

var selectorUtils = {
    findAllIncludes: function (selector, fullPaths, home) {
        selectorUtils.normalizeIncludeVsIncludes(selector);
        utils.debugLog("includes", selector.Includes);
        return minimatchEngine(selector, fullPaths, home, "Includes");
    },

    removeAllExcludes: function (selector, fullPaths, home) {
        selectorUtils.normalizeExcludeVsExcludes(selector);
        utils.debugLog("Excludes", selector.Excludes);

        var excludes = minimatchEngine(selector, fullPaths, home, "Excludes");
        return fullPaths.filter((includePath) => excludes.indexOf(includePath) === -1);
    },

    normalizeExcludeVsExcludes: function (selector) {
        if (selector.Exclude && !selector.Excludes) {
            selector.Excludes = selector.Exclude;
            delete selector.Exclude;
        }

        if (!selector.Excludes) {
            selector.Excludes = [];
        }
        if (!Array.isArray(selector.Excludes)) {
            selector.Excludes = [selector.Excludes];
        }
    },

    normalizeIncludeVsIncludes: function (selector) {
        // TODO: The Chutzpah docs say these are both plural,
        // but I'm seeing json files with, eg, Include instead of
        // Includes.
        // https://github.com/mmanela/chutzpah/wiki/references-setting
        //
        // Same with excludes, above.
        //
        // I'm not supporting both; this privileges Include singular over
        // Includes plural, erasing plural if singular exists. Is that smart?
        //
        // Also, if a selector doesn't exist, should we return everything?
        // (Probably so? Maybe not? That's what we're doing now.)
        if (selector.Include && !selector.Includes) {
            selector.Includes = selector.Include;
            delete selector.Include;
        }
        if (!selector.Includes) {
            selector.Includes = [];
        }
        if (!Array.isArray(selector.Includes)) {
            selector.Includes = [selector.Includes];
        }
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

function handleChutzpahSelector(selector, chutzpahJsonFileParent, type, nth) {
    utils.debugLog({
        title: "handleChutzpahSelector",
        selector,
        jsonFileParent: chutzpahJsonFileParent,
    });

    if (!selector.Path) {
        selector.Path = chutzpahJsonFileParent;
    }

    // I don't know that we *have* to ensure the files exist, but to use fs.existsSync,
    // we have to either get a relative path from where this app *IS RUNNING*
    // "relative to process.cwd()" https://stackoverflow.com/a/58470609/1028230
    // rather than from jsonFileParent, of course. So we either need to get a full
    // path or do some fancy acrobatics.
    var selectorFullPath =
        selector.Path.startsWith(chutzpahJsonFileParent) || selector.Path.startsWith("*")
            ? selector.Path
            : nodePath.join(chutzpahJsonFileParent, selector.Path);

    if (fs.existsSync(selectorFullPath)) {
        var selectorMatchesFullPaths;
        var pathIsDir = fs.statSync(selectorFullPath).isDirectory();

        if (pathIsDir) {
            // 1. Get all files in this and any subdirectory.
            // TODO: This will throw on a bogus path (but we checked with existsSync)
            // and return [] on an empty folder.
            selectorMatchesFullPaths =
                fileSystemService.getAllFilePaths(selectorFullPath);

            // 2. Run the file paths against include & exclude globs from config.
            utils.debugLog(`all files for ${nth}th ${type} selector before filtering:
    ${selectorFullPath}
${JSON.stringify(selectorMatchesFullPaths, null, "  ")}

`);

            selectorMatchesFullPaths = selectorUtils.findAllIncludes(
                selector,
                selectorMatchesFullPaths,
                chutzpahJsonFileParent
            );
            selectorMatchesFullPaths = selectorUtils.removeAllExcludes(
                selector,
                selectorMatchesFullPaths,
                chutzpahJsonFileParent
            );

            utils.debugLog(`and after filtering:
    ${JSON.stringify(selectorMatchesFullPaths, null, "  ")}

`);
        } else {
            selectorMatchesFullPaths = [
                nodePath.join(chutzpahJsonFileParent, selector.Path),
            ];
        }

        return selectorMatchesFullPaths;
    }

    console.warn(`${selectorFullPath} from json does not exist`);
    return [];
}

// AggressiveStar means a value of "*.js" looks for "*.js" in EVERY folder,
// recurisvely rather than simply for files that match ONLY at the root level folder.
// Some glob evaluators seem to do this and some don't. (???)
// See, eg, https://github.com/isaacs/minimatch/issues/172#issuecomment-1359582179
// minimatch (lib we're using for glob selection) doesn't but Chutzpah's glob lib did,
// so we need to translate. And by "translate", I mean add "**/[pattern with single star]"
// to the selectors (Include or Exclude as appropriate) to match Chutzpah's glob expectations.
function handleAggressiveStar(configInfo) {
    var ocdDryPropNames = ["References", "Tests"];
    var ocdDryArrayNames = ["Includes", "Excludes"];

    ocdDryPropNames.forEach(function (refsOrTests) {
        configInfo[refsOrTests] = Array.isArray(configInfo[refsOrTests])
            ? configInfo[refsOrTests]
            : [configInfo[refsOrTests]];

        configInfo[refsOrTests].forEach((singleRefOrTestEntry) => {
            selectorUtils.normalizeIncludeVsIncludes(singleRefOrTestEntry);
            selectorUtils.normalizeExcludeVsExcludes(singleRefOrTestEntry);

            ocdDryArrayNames.forEach((includesOrExcludes) => {
                // There's no requirement that single files have In- and Ex-cludes so truthycheck 'em.
                if (singleRefOrTestEntry[includesOrExcludes]) {
                    singleRefOrTestEntry[includesOrExcludes] = Array.isArray(
                        singleRefOrTestEntry[includesOrExcludes]
                    )
                        ? singleRefOrTestEntry[includesOrExcludes]
                        : [singleRefOrTestEntry[includesOrExcludes]];

                    var toAdd = [];
                    singleRefOrTestEntry[includesOrExcludes].forEach((singlePath) => {
                        // Here's where we translate "*.js" to "**/*.js" to approximate
                        // Chutzpah's glob selection logic.
                        if (singlePath.startsWith("*") && !singlePath.startsWith("**")) {
                            var allFoldersSelector = "**/" + singlePath;
                            if (
                                !singleRefOrTestEntry[includesOrExcludes].find(
                                    (x) => x === allFoldersSelector
                                )
                            ) {
                                utils.debugLog(
                                    `GOING AGGRESSIVE!!! ${refsOrTests} - ${singlePath}`
                                );

                                // Note that we're not deleting the old entry but adding the
                                // superset. Cute, I guess.
                                toAdd.push(allFoldersSelector);
                            }
                        }
                    });

                    singleRefOrTestEntry[includesOrExcludes] =
                        singleRefOrTestEntry[includesOrExcludes].concat(toAdd);
                }
            });
        });
    });
}

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

var re = /^\*\/|\/\*\/|\/\*$/g;
function coverageAggressiveStar(s) {
    return s.replace(re, starReplacer);
}

// GET ALL REFERENCE FILES (files needed to run stuff)
function getRefFiles(chutzpahConfigObj, jsonFileParent) {
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
    // Looks like even full Windows paths work here with forward slashes. Weird.
    allRefFilePaths = fileSystemService.filterNonexistentPaths(
        allRefFilePaths,
        "References"
    );

    // allRefFilePaths = allRefFilePaths.map((x) =>
    //     x.replace(jsonFileParent.replace(/\\/g, "/"), "")
    // );

    return allRefFilePaths;
}

function getSpecFiles(singleTestFile, chutzpahConfigObj, jsonFileParent) {
    // GET ALL FILES THAT HAVE TESTS TO RUN
    var specFiles = [];
    if (!singleTestFile) {
        chutzpahConfigObj.Tests.forEach(function (ref, i) {
            var filesForSelector = handleChutzpahSelector(ref, jsonFileParent, "Test", i);

            specFiles = mergeAndDedupe(specFiles, filesForSelector);
        });
    } else {
        specFiles = [singleTestFile];
    }

    specFiles = fileSystemService.filterNonexistentPaths(specFiles, "Test (spec files)");
    return specFiles;
}

function getCoverageFiles(chutzpahConfigObj, allRefFilePaths) {
    var coverageFiles = [];

    if (Array.isArray(chutzpahConfigObj.CodeCoverageIncludes)) {
        chutzpahConfigObj.CodeCoverageIncludes.forEach((coverageIncludePattern) => {
            // if (!isWindows) {
            coverageIncludePattern = coverageIncludePattern.replace(/\\/g, "/");
            // }

            if (!chutzpahConfigObj.NoAggressiveStar) {
                // TODO: This doesn't seem to be written for single file entries.
                // ????: Why wouldn't logic for Ref/Spec In/Excludes work?
                coverageIncludePattern = coverageAggressiveStar(coverageIncludePattern);
            }

            coverageFiles = coverageFiles.concat(
                minimatch.match(allRefFilePaths, coverageIncludePattern)
            );

            utils.debugLog(coverageIncludePattern, coverageFiles);
        });
    }

    // TODO: CodeCoverageExcludes
    console.warn("TODO: CodeCoverageExcludes");

    return coverageFiles;
}

// 1. Recurse folders, match, and get ref files
// 2. Get spec files
// 3. Get coverage files
// 4. Return results as a single object.
function parseChutzpahInfo(chutzpahConfigObj, jsonFileParent, singleTestFile) {
    if (!chutzpahConfigObj.NoAggressiveStar) {
        handleAggressiveStar(chutzpahConfigObj);
    }

    var allRefFilePaths = getRefFiles(chutzpahConfigObj, jsonFileParent);
    var specFiles = getSpecFiles(singleTestFile, chutzpahConfigObj, jsonFileParent);

    if (!specFiles.length) {
        throw "No files to test! " + JSON.stringify(chutzpahConfigObj.Tests);
    }

    // REMOVE ANY SPEC FILES FOUND IN REFERENCES
    // Chutzpah doesn't seem to make a distinction between what should be referenced
    // and what should be tested -- or, more specifically, you can ref tests in that tool
    // without causing an issue (I think?).
    // Let's remove any test files from our ref files so they're not duplicated.
    // (I mean, I guess it'd work with them, but you get the point that tests shouldn't
    //  be coverage tested.)
    allRefFilePaths = allRefFilePaths.filter((path) => specFiles.indexOf(path) === -1);

    var coverageFiles = getCoverageFiles(chutzpahConfigObj, allRefFilePaths);

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

    var statsObj = fs.statSync(startPath);
    // If it's a file, grab the parent dir.
    var possibleDir = statsObj.isDirectory() ? startPath : nodePath.dirname(startPath);

    var foundChutzpahJson = undefined;
    while (!foundChutzpahJson) {
        utils.debugLog("checking: " + possibleDir);
        var tryHere = nodePath.join(possibleDir, "Chutzpah.json");
        if (fs.existsSync(tryHere)) {
            foundChutzpahJson = tryHere;
        } else {
            var newPossibleDir = nodePath.dirname(possibleDir);
            if (newPossibleDir === possibleDir) {
                throw `No Chutzpah.json file found in same dir or parent: ${startPath}`;
            }
            possibleDir = newPossibleDir;
            // utils.debugLog("Next dir up: " + possibleDir);
        }
    }

    return foundChutzpahJson;
}

// ===============================================================================================
// 1. findChutzpahJson: Finds chutzpah config using original path (the function's only parameter)
//      * can be a test file or a folder.
//      * find closest Chutzpah.json (by name)
//          file at that folder (or file's parent folder) or "lower"
// 2. fileSystemService.getFileContents (Promise returned): Get json file's contents.
// 3. parseChutzpahInfo: Send contents as POJSO and process into object with these properties:
//      * allRefFilePaths,
//      * specFiles,
//      * coverageFiles,
// 4. Return object with info from 3. plus some initialization info
//      return {
//          originalTestPath,
//          configFilePath,
//          jsonFileParent,
//          allRefFilePaths: info.allRefFilePaths,
//          specFiles: info.specFiles,
//          coverageFiles: info.coverageFiles,
//      };
// ===============================================================================================
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

    utils.debugLog("Reading Chutzpah config: " + configFilePath);
    var jsonFilePath = nodePath.normalize(configFilePath);
    var jsonFileParent = nodePath.dirname(jsonFilePath);

    var singleTestFile =
        originalTestPath.toLowerCase().endsWith(".js") ||
        originalTestPath.toLowerCase().endsWith(".ts")
            ? originalTestPath
            : false;

    return fileSystemService.getFileContents(jsonFilePath).then(function (chutzpahJson) {
        var chutzpahConfigObj = JSON.parse(chutzpahJson);
        utils.debugLog("read chutzpah json", chutzpahConfigObj);

        var info = parseChutzpahInfo(chutzpahConfigObj, jsonFileParent, singleTestFile);
        utils.debugLog(info);

        return {
            originalTestPath,
            configFilePath,
            jsonFileParent,
            allRefFilePaths: info.allRefFilePaths,
            specFiles: info.specFiles,
            coverageFiles: info.coverageFiles,
        };
    });
}

if (require.main === module) {
    // First two are always "Node" and the path to what was called.
    // Trash those.
    const myArgs = process.argv.slice(2);
    utils.debugLog("myArgs: ", myArgs);

    fileSystemService.getFileContents("C:\\temp\\chutzpahTestValues.json").then(
        (testValueFileContents) => {
            var testConfigPath = JSON.parse(testValueFileContents).singleChutzpah;

            fileSystemService.getFileContents(testConfigPath).then(
                getConfigInfo(testConfigPath).then(
                    (values) => {
                        var valuesAsString = JSON.stringify(values, null, "  ");
                        utils.debugLog(valuesAsString);
                        fs.writeFileSync(
                            "C:\\temp\\parsedChutzpahValues.json",
                            valuesAsString
                        );
                    },
                    (err) => console.error("2", err)
                ),
                (err) => console.error("1", err)
            );
        },
        (err) => console.error("0", err)
    );
}

module.exports = {
    getConfigInfo,
    findChutzpahJson, // okay, this was made public only for testing. That's bad.
};
