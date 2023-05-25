const karma = require("karma");
const Server = karma.Server;
const fs = require("fs");
const nodePath = require("node:path");
const opener = require("opener");

const karmaConfigTools = require("./karmaConfigTools");
const utils = require("../helpers/utils");

function startKarma(overrides) {
    overrides = Object.assign({}, karmaConfigTools.overridesForCoverage, overrides);
    var karmaConfig = karmaConfigTools.createKarmaConfig(overrides);
    utils.debugLog(karmaConfig);

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
                        utils.debugLog("Karma has exited with " + exitCode);
                        utils.debugLog(arguments);

                        var coverageDir = nodePath.join(karmaConfig.basePath, "coverage");

                        fs.readdir(coverageDir, function (err, list) {
                            var latestCoverageDir = "";
                            var latestTime = 0;
                            utils.debugLog(list, err);

                            list.forEach((file) => {
                                // TODO: Change when we have other browsers, natch.
                                if (file.indexOf("Chrome") > -1) {
                                    var fullPath = nodePath.join(coverageDir, file);
                                    var statsObj = fs.statSync(fullPath);
                                    if (statsObj.isDirectory()) {
                                        utils.debugLog(`
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
                                utils.debugLog(latestCoverageDir);
                                var coverageFilePath = nodePath.join(
                                    latestCoverageDir,
                                    "index.html"
                                );
                                opener(coverageFilePath);

                                resolve(0);
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

function runKarmaCoverage(configInfo) {
    // The config object gives back a collection of all refs (not tests)
    // in allRefFilePaths and the tests in specFiles.
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
        // files: [{ pattern: "**/*.js", nocache: true }],
        // string-only is equivalent to...
        // equal to {pattern: theStringPath, watched: true, served: true, included: true}
        files: allFiles,
        // everything but the tests.
        // "**/!(*test).js": ["coverage"],
        preprocessors: preprocessObj,
    };

    utils.debugLog("config overrides for karma:", overrides);

    return startKarma(overrides);
}

if (require.main === module) {
    // First two are always "Node" and the path to what was called.
    // Trash those.
    const myArgs = process.argv.slice(2);
    utils.alwaysLog("myArgs: ", myArgs);

    var basePath = myArgs[0];

    startKarma(basePath).then(function () {
        utils.alwaysLog("done");
    });
}

module.exports = {
    runKarmaCoverage,
};
