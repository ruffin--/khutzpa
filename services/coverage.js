const karma = require("karma");
const Server = karma.Server;
const fs = require("fs");
const nodePath = require("node:path");

const karmaConfigTools = require("./karmaConfigTools");
const utils = require("../helpers/utils");
const urlOpener = require("./urlOpener");

// https://stackoverflow.com/a/52338335/1028230
function copyFolderSync(from, to) {
    if (!fs.existsSync(to)) {
        fs.mkdirSync(to);
    }

    fs.readdirSync(from).forEach((element) => {
        if (fs.lstatSync(nodePath.join(from, element)).isFile()) {
            fs.copyFileSync(nodePath.join(from, element), nodePath.join(to, element));
        } else {
            copyFolderSync(nodePath.join(from, element), nodePath.join(to, element));
        }
    });
}

function copyCoverageFiles(coverageDir, newIndexLoc) {
    var newCoverageDir = nodePath.dirname(newIndexLoc);

    copyFolderSync(coverageDir, newCoverageDir);

    var oldIndexLoc = nodePath.join(coverageDir, "index.html");
    fs.copyFileSync(oldIndexLoc, newIndexLoc);
}

function startKarmaCoverageRun(overrides, outFile, codeCoverageSuccessPercentage) {
    overrides = Object.assign({}, karmaConfigTools.overridesForCoverage, overrides);
    var karmaConfig = karmaConfigTools.createKarmaConfig(
        overrides,
        codeCoverageSuccessPercentage
    );
    utils.logit(karmaConfig);

    return new Promise(function (resolve, reject) {
        karma.config
            .parseConfig(
                null,
                karmaConfig,

                // In most cases, parseOptions.throwErrors = true should also be set.
                // This disables process exiting and allows errors to result in rejected promises.
                // http://karma-runner.github.io/6.3/dev/public-api.html
                { promiseConfig: true, throwErrors: true }
            )
            .then(
                (parsedKarmaConfig) => {
                    // fwiw
                    // http://karma-runner.github.io/6.4/dev/public-api.html
                    // I'm not sure why it names the callback function.
                    const server = new Server(parsedKarmaConfig, function doneCallback(
                        exitCode
                    ) {
                        utils.logit("Karma has exited with " + exitCode);
                        utils.logit(arguments);

                        var coverageDirName = "coverage";
                        // TODO: This is a dangerous default once we support other browsers.
                        var coverageSubDir = "Chrome";
                        if (parsedKarmaConfig && parsedKarmaConfig.coverageReporter) {
                            // covereporter can have an array of reporters instead of one.
                            // https://github.com/karma-runner/karma-coverage/blob/HEAD/docs/configuration.md#reporters
                            var htmlReporterInfo = parsedKarmaConfig.coverageReporter;
                            if (Array.isArray(htmlReporterInfo.reporters)) {
                                htmlReporterInfo =
                                    htmlReporterInfo.reporters.find(
                                        (x) => x.type === "html"
                                    ) || htmlReporterInfo;
                            }

                            coverageDirName = htmlReporterInfo.dir || coverageDir;
                            coverageSubDir = htmlReporterInfo.subdir || coverageSubDir;
                        }

                        var coverageDir = nodePath.join(
                            karmaConfig.basePath,
                            coverageDirName
                        );
                        fs.readdir(coverageDir, function (err, list) {
                            var latestCoverageDir = "";
                            var latestTime = 0;
                            utils.logit(list, err);

                            list.forEach((file) => {
                                // TODO: Keep in mind that subdir can be configured by a function.
                                // https://github.com/karma-runner/karma-coverage/blob/master/docs/configuration.md#subdir
                                // NOTE: coverageSubDir value can be anywhere in file... which allows the default "Chrome" to match
                                // the wacky default folder name construction like "Chrome 118.0.0.0 (Mac OS 10.15.7)"
                                // -- TODO: ^^^^ as long as we only use Chrome.
                                if (file.indexOf(coverageSubDir) > -1) {
                                    var fullPath = nodePath.join(coverageDir, file);
                                    var statsObj = fs.statSync(fullPath);
                                    if (statsObj.isDirectory()) {
                                        utils.logit(`
path: ${fullPath}
last accessed: ${statsObj.atimeMs},
last changed:  ${statsObj.ctimeMs},
last modified: ${statsObj.mtimeMs},
                                `);
                                    }

                                    if (statsObj.ctimeMs > latestTime) {
                                        latestTime = statsObj.ctimeMs;
                                        latestCoverageDir = fullPath;
                                    }
                                }
                            });

                            if (latestCoverageDir) {
                                utils.logit(latestCoverageDir);

                                if (outFile) {
                                    copyCoverageFiles(latestCoverageDir, outFile);
                                    // We're going to let you open the file yourself if you used coveragehtml
                                    // mostly because that's what Chutzpah Runner does.
                                } else {
                                    var coverageFilePath = nodePath.join(
                                        latestCoverageDir,
                                        "index.html"
                                    );

                                    urlOpener.openUrl(coverageFilePath);
                                }

                                resolve(exitCode);
                            } else {
                                reject(new Error("No coverage directory found!"));
                            }
                        });
                    });

                    server.start();
                },
                (rejectReason) => {
                    /* respond to the rejection reason error */
                    console.error("Error", rejectReason);
                }
            );
    });
}

function runKarmaCoverage(configInfo, outFile) {
    // The config object gives back a collection of all refs (ie, required
    // files that aren't tests) in allRefFilePaths and the tests in specFiles.
    // karma's files property wants everything... I think...
    // So first let's put the two together.
    var allFiles = configInfo.allRefFilePaths.concat(configInfo.specFiles);

    // Now we need an object literal with each file to cover to tell karma
    // to use the coverage preprocessor to, um, preprocess those files.
    // We could use wildcard patterns, but this is much more straightforward
    // (if not efficient -- though I suspect this means karma is doing less
    // lifting and it doesn't matter).
    var preprocessObj = {};
    configInfo.coverageFiles.forEach((fileToCover) => {
        preprocessObj[fileToCover] = ["coverage"];
    });

    var overrides = {
        port: 9876,
        basePath: configInfo.jsonFileParent,
        // files: [{ pattern: "**/*.js", nocache: true }], // NOTE: nocache true breaks the coverage reporter.

        // string-only is equivalent to...
        // {pattern: theStringPath, watched: true, served: true, included: true}
        files: allFiles,

        // everything but the tests.
        // "**/!(*test).js": ["coverage"],
        preprocessors: preprocessObj,
    };

    var codeCoverageSuccessPercentage = parseInt(
        configInfo.codeCoverageSuccessPercentage,
        10
    );

    utils.logit(
        "config overrides for karma (and codeCoverageSuccessPercentage, if exists):",
        overrides,
        codeCoverageSuccessPercentage
    );

    return startKarmaCoverageRun(overrides, outFile, codeCoverageSuccessPercentage);
}

if (require.main === module) {
    // First two are always "Node" and the path to what was called.
    // Trash those.
    const myArgs = process.argv.slice(2);
    utils.alwaysLog("myArgs: ", myArgs);

    var basePath = myArgs[0];

    startKarmaCoverageRun(basePath).then(function () {
        utils.alwaysLog("done");
    });
}

module.exports = {
    runKarmaCoverage,
};
