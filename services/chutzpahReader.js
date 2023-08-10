/* eslint-disable quotes */
const fs = require("fs");
// NOTE: node:path requires node v16+
const nodePath = require("node:path");
const fileSystemService = require("./fileSystemService");
const utils = require("../helpers/utils");
const selectorUtils = require("../helpers/selectorUtilities");
const prompt = require("prompt-sync")({ sigint: true });

// TODO: This seems like it should be unnecessary, but also makes values
// easier to grok when debugging. I can't tell if it's too hacky or legit.
// Better than the old home-rolled windows checks, I guess.
function standardizePathSeparatorInPlace(paths) {
    // I don't know why, but this ninja reassignment feels smelly.
    // You should probably also check for legit escapes. This is like
    // minimatch's windowsPathNoEscape -- tres hacky.
    // https://github.com/isaacs/minimatch#windowspathsnoescape
    paths.forEach((x, i) => (paths[i] = x.replace(/\\/g, "/")));
}

function mergeDedupeAndStandardizePathSeparator(parentCollection, newFiles) {
    // let's standardize on *NIX paths.
    // TODO: I think there's a node function for this.
    // Oh good heavens: https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file#fully-qualified-vs-relative-paths
    standardizePathSeparatorInPlace(newFiles);

    var filesForSelectorDeduped = newFiles.filter(
        (x) => parentCollection.indexOf(x) === -1
    );

    return parentCollection.concat(filesForSelectorDeduped);
}

// TODO: This is effectively but entirely too aggressive.
function filterJasmine(collection) {
    var jasmineHits = [];
    var filteredCollection = collection.filter((x) => {
        var hit =
            x.toLowerCase().indexOf("jasmine") > -1 && x.toLowerCase().endsWith(".js");

        if (hit) {
            jasmineHits.push(x);
        }

        // Keep if NOT jasmine.
        return !hit;
    });

    if (jasmineHits.length) {
        console.warn(`
!!!!!! JASMINE POTENTIALLY FOUND !!!!!!
${jasmineHits.join("\n")}

We're ignoring any files that contains the characters "jasmine" and ends in ".js".
khutzpa provides its own version of jasmine.  Referencing another version of jasmine can
break tests. Currently skipping this file.

Note: There is currently no way to override this check.
TODO: Allow overriding this check.`);
    }

    return filteredCollection;
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

    // Tacked on logic to handle paths hosted via http.
    if (selector.Path.toLowerCase().startsWith("http")) {
        // Currently no QA for web paths -- invalid url, you're toast.
        // TODO: Support gopher:// ?
        return [selector.Path];
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

            // 2. For now, over-aggressively remove jasmine files.
            selectorMatchesFullPaths = filterJasmine(selectorMatchesFullPaths);

            // 3. Run the file paths against include & exclude globs from config.
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

            utils.debugLog(`all files for ${nth}th ${type} selector after filtering:
    ${JSON.stringify(selectorMatchesFullPaths, null, "  ")}

`);
        } else {
            selectorMatchesFullPaths = filterJasmine([
                nodePath.join(chutzpahJsonFileParent, selector.Path),
            ]);
        }

        return selectorMatchesFullPaths;
    }

    console.warn(`${selectorFullPath} from json does not exist`);
    return [];
}

function _aggressiveStarEngine(selectorArray, parentPropertyForReporting) {
    var toAdd = [];

    // There's no requirement that single files have In- and Ex-cludes so truthycheck 'em.
    if (selectorArray) {
        selectorArray = Array.isArray(selectorArray) ? selectorArray : [selectorArray];

        selectorArray.forEach((singlePath) => {
            var out = singlePath;
            if (out === "*") {
                out = "**/*.*";
            } else {
                // first get rid of any single stars representing directories.
                // /a/b/*/c/*.js to /a/b/**/c/*.js
                // */b/c/*.js to **/b/c/*.js
                out = out.replace(/(^|\/|\\)\*(\/|\\)/g, "$1**$2");
                // /a/b/c/* to /a/b/c/** <<< not sure that's valid.
                // Let's try a/b/c/**/*.*
                out = out.replace(/(\/|\\)\*$/g, "$1**$1*.*");

                if (out.startsWith("*") && !out.startsWith("**")) {
                    out = "**/" + out;
                }
            }

            if (!selectorArray.find((x) => x === out)) {
                // Note that we're not deleting the old entry but adding the
                // superset. Cute, I guess.
                toAdd.push(out);
            }
        });
    }

    return toAdd;
}

// AggressiveStar means a value of "*.js" looks for "*.js" in EVERY folder,
// recurisvely rather than simply for files that match ONLY at the root level folder.
// Some glob evaluators seem to do this and some don't. (???)
// See, eg, https://github.com/isaacs/minimatch/issues/172#issuecomment-1359582179
// minimatch (lib we're using for glob selection) doesn't but Chutzpah's glob lib did,
// so we need to translate. And by "translate", I mean add
// "**/[pattern with single star]"
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

            ocdDryArrayNames.forEach(function (includesOrExcludes) {
                singleRefOrTestEntry[includesOrExcludes] = singleRefOrTestEntry[
                    includesOrExcludes
                ].concat(
                    _aggressiveStarEngine(
                        singleRefOrTestEntry[includesOrExcludes],
                        refsOrTests
                    )
                );
            });
        });
    });

    // now do the same for coverage includes and excludes.
    configInfo.CodeCoverageIncludes = (configInfo.CodeCoverageIncludes || []).concat(
        _aggressiveStarEngine(configInfo.CodeCoverageIncludes, "coverageIncludes")
    );
    configInfo.CodeCoverageIgnores = (configInfo.CodeCoverageIgnores || []).concat(
        _aggressiveStarEngine(configInfo.CodeCoverageIgnores, "coverageIgnores")
    );
    configInfo.CodeCoverageExcludes = (configInfo.CodeCoverageExcludes || []).concat(
        _aggressiveStarEngine(configInfo.CodeCoverageExcludes, "coverageExcludes")
    );
}

// GET ALL REFERENCE FILES (files needed to run stuff)
function findAllRefFiles(chutzpahConfigObj, jsonFileParent) {
    var allRefFilePaths = [];
    chutzpahConfigObj.References.forEach(function (singleReferenceEntry, i) {
        var filesForSelector = handleChutzpahSelector(
            singleReferenceEntry,
            jsonFileParent,
            "Reference",
            i
        );

        allRefFilePaths = mergeDedupeAndStandardizePathSeparator(
            allRefFilePaths,
            filesForSelector
        );
    });

    // ensure they all exist
    // Looks like even full Windows paths work here with forward slashes. Weird.
    allRefFilePaths = fileSystemService.filterNonexistentPaths(
        allRefFilePaths,
        "References"
    );

    return allRefFilePaths;
}

// GET ALL FILES THAT HAVE TESTS TO RUN
function getSpecFiles(singleTestFile, chutzpahConfigObj, jsonFileParent) {
    // Had a report of khutzpa not working with a single file.
    // Was because the file did not contain tests!
    // Let's check for that here by ensuring it's covered by the Tests property.
    // This means we have to get the Tests even in singleTestFile mode.
    var specFiles = [];
    chutzpahConfigObj.Tests.forEach(function (singleReferenceEntry, i) {
        var filesForSelector = handleChutzpahSelector(
            singleReferenceEntry,
            jsonFileParent,
            "Test",
            i
        );

        specFiles = mergeDedupeAndStandardizePathSeparator(specFiles, filesForSelector);
    });

    if (singleTestFile) {
        if (specFiles.indexOf(singleTestFile.replace(/\\/g, "/")) === -1) {
            console.error(`

You have given khutzpa a parameter pointing to a single file
(not a directory):

${singleTestFile}

!!!!!! That file is not included by your configuration file's \`Tests\` selectors. !!!!!!

There are no tests to run.
`);
            if (!chutzpahConfigObj.noUserInput) {
                prompt(
                    "Press return to exit khutzpa (and set noUserInput in config to remove this pause)."
                );
            }
            process.exit(2);
        }

        specFiles = [singleTestFile];
    }

    return fileSystemService.filterNonexistentPaths(specFiles, "Test (spec files)");
}

function getCoverageFiles(chutzpahConfigObj, allRefFilePaths, jsonFileParent) {
    // the easiest way to reuse our current selector logic is to take
    // CodeCoverageIncludes & CodeCoverageExcludes and make a selector
    // out of them.

    // This is a very naive implementation for CodeCoverageIgnores vs.
    // CodeCoverageExcludes. For now, it simply ensures we do *something* with both
    // excludes and ignores for code coverage for some level of backwards
    // compatibility.  In this implementation, CodeCoverageIgnores and
    // CodeCoverageExcludes are treated the same.
    // That is, downstream we currently ONLY LOOK AT IGNORES.
    // https://github.com/mmanela/chutzpah/wiki/Chutzpah.json-Settings-File
    var fakeSelector = {
        Path: jsonFileParent,
        Includes: chutzpahConfigObj.CodeCoverageIncludes,
        Excludes: chutzpahConfigObj.CodeCoverageIgnores.concat(
            chutzpahConfigObj.CodeCoverageExcludes
        ),
    };

    // I think we're really only interested in ref files, though, so we'll
    // want to filter these.
    var unfilteredMatches = handleChutzpahSelector(
        fakeSelector,
        jsonFileParent,
        "Coverage",
        0
    );

    standardizePathSeparatorInPlace(unfilteredMatches);

    return unfilteredMatches.filter((x) => allRefFilePaths.indexOf(x) > -1);
}

// 1. Recurse folders, match, and get ref files
// 2. Get spec files
// 3. Get coverage files
// 4. Return results as a single object.
function parseChutzpahInfo(chutzpahConfigObj, jsonFileParent, singleTestFile) {
    if (!chutzpahConfigObj.NoAggressiveStar) {
        handleAggressiveStar(chutzpahConfigObj);
    }

    var allRefFilePaths = findAllRefFiles(chutzpahConfigObj, jsonFileParent);
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

    var coverageFiles = getCoverageFiles(
        chutzpahConfigObj,
        allRefFilePaths,
        jsonFileParent
    );

    var toReturn = {
        allRefFilePaths,
        specFiles,
        coverageFiles,
    };

    utils.debugLog("x:logLevel,5", toReturn);

    return toReturn;
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

    configFilePath = nodePath.resolve(configFilePath);

    console.log("Reading Chutzpah config: " + configFilePath);
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
            singleTestFile,
            allRefFilePaths: info.allRefFilePaths,
            specFiles: info.specFiles,
            coverageFiles: info.coverageFiles,
            codeCoverageSuccessPercentage:
                chutzpahConfigObj.CodeCoverageSuccessPercentage,
            produceTrx: chutzpahConfigObj.ProduceTrx,
            trxPath: chutzpahConfigObj.TrxPath,
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
