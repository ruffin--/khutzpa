/************************************************
 * Right now, this runs coverage and a pass/fail
 * test suite when exexcuted.
 ************************************************/
const karma = require("karma");
const nodePath = require("node:path");

const karmaConfigTools = require("./karmaConfigTools");
const utils = require("../helpers/utils");

const winDrivePattern = new RegExp(/^[a-z]:\\/, "i");

let karmaRunIds = [];
let karmaRunResults = {};

function addIfNotExists(array, newElements) {
    // Should probably clone `array` and call it "mergeArrays" or something
    if (!Array.isArray(array)) {
        array = [];
    }

    if (!Array.isArray(newElements)) {
        newElements = [newElements];
    }

    newElements.forEach((x) => {
        if (array.indexOf(x) === -1) {
            array.push(x);
        }
    });

    return array;
}

function startKarmaAsync(karmaRunId, overrides) {
    return new Promise(function (resolve, reject) {
        overrides = Object.assign(
            {},
            karmaConfigTools.overridesForMochaTestingRun,
            overrides
        );

        // ##############################################################
        // This is where we make the karmaConfig
        // ##############################################################
        var karmaConfig = karmaConfigTools.createKarmaConfig(overrides);

        utils.debugLog("karma config", karmaConfig);

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
                    // I'm not sure why it names the callback function doneCallback.
                    const server = new karma.Server(
                        parsedKarmaConfig,
                        function doneCallback(exitCode) {
                            // 0 is success/no test failure.
                            // Anything else is bad. Usually 1 afaict.
                            utils.logit("Wrapped karma has exited with " + exitCode);
                            karmaRunResults[karmaRunId] = exitCode;

                            resolve(exitCode);
                        }
                    ).on("progress", function (data) {
                        process.stdout.write(data);
                    });

                    server.start().then(function (x) {
                        utils.logit("server started", x);
                    });
                },
                (rejectReason) => {
                    utils.logit("Error", rejectReason);
                    throw rejectReason;
                }
            );
    });
}

// The puts together overrides for the karma run, but doesn't actually call it.
// It sends those overrides over by calling startKarmaAsync.
function runWrappedKarma(khutzpaConfigInfo, karmaRunId) {
    // The config object gives back a collection of all refs (ie, required
    // files that aren't tests) in allRefFilePaths and the tests in specFiles.
    // karma's files property wants everything... I think...
    // So first let's put the two together.
    var allFiles = khutzpaConfigInfo.allRefFilePaths.concat(khutzpaConfigInfo.specFiles);

    // Now we need an object literal with each file to cover to tell karma
    // to use the coverage preprocessor to, um, preprocess those files.
    // We could use wildcard patterns, but this is much more straightforward
    // (if not efficient -- though I suspect this means karma is doing less
    // lifting and it doesn't matter).
    var preprocessObj = {};
    khutzpaConfigInfo.coverageFiles.forEach((fileToCover) => {
        preprocessObj[fileToCover] = ["coverage"];
    });

    var overrides = {
        port: 9876,
        basePath: khutzpaConfigInfo.jsonFileParent,
        // files: [{ pattern: "**/*.js", nocache: true }], // NOTE: nocache true breaks the coverage reporter.

        // string-only is equivalent to...
        // {pattern: theStringPath, watched: true, served: true, included: true}
        files: allFiles,

        // everything but the tests.
        // "**/!(*test).js": ["coverage"],
        preprocessors: preprocessObj,
    };

    if (parseInt(khutzpaConfigInfo.seed) !== NaN || khutzpaConfigInfo.random) {
        if (!overrides.jasmine) {
            overrides.jasmine = {};
        }
        overrides.jasmine.seed = khutzpaConfigInfo.seed;
        overrides.jasmine.random = khutzpaConfigInfo.random;
    }

    // if we only have one test file, no reason to do any coverage.
    if (khutzpaConfigInfo.singleTestFile) {
        overrides.reporters = ["mocha"];
    } else {
        // this is actually the default in karmaConfigTools, but let's be explicit.
        overrides.reporters = ["coverage", "mocha"];

        var codeCoverageSuccessPercentage = parseInt(
            khutzpaConfigInfo.codeCoverageSuccessPercentage,
            10
        );

        if (codeCoverageSuccessPercentage) {
            // https://github.com/karma-runner/karma-coverage/blob/master/docs/configuration.md#check
            overrides.coverageReporter = {
                reporters: [{ type: "text-summary" }],
                check: {
                    emitWarning: false,
                    global: {
                        statements: codeCoverageSuccessPercentage,
                        branches: codeCoverageSuccessPercentage,
                        functions: codeCoverageSuccessPercentage,
                        lines: codeCoverageSuccessPercentage,
                    },
                },
            };
        }
    }

    // This creates a file needed for TFS integration.
    // More info:
    // https://stackoverflow.com/q/38952063/1028230
    // https://github.com/hatchteam/karma-trx-reporter
    // TODO: Instead of Object.assign, consider a merge that merges matching
    // (by prop name) arrays?
    // This overrides where you're really setting something is getting wack.
    if (khutzpaConfigInfo.produceTrx) {
        // It's already got mocha in it as of 20230906, but let's pretend that might change
        // and be defensive.
        overrides.reporters = addIfNotExists(overrides.reporters, ["mocha", "trx"]);

        let trxPath = khutzpaConfigInfo.trxPath || "khutzpa-test-results.trx";

        // TODO: The second check is problematic b/c we *accept* "/Relative/Path/file.js"
        // in References and Tests. I'm not sure how to check for *NIX full paths without
        // changing that setup or having a leading "/" mean different things for different
        // config properties (like I do now (20230804), here).
        // Check for the existence of the parent of the trxPath here? If not exists, join?
        if (!winDrivePattern.test(trxPath) && !trxPath.startsWith("/")) {
            trxPath = nodePath.join(khutzpaConfigInfo.jsonFileParent, trxPath);
        }

        overrides.trxReporter = {
            outputFile: trxPath,
            shortTestName: false,
        };
    }

    utils.logit("config overrides for karma:", overrides);
    return startKarmaAsync(karmaRunId, overrides);
}

if (require.main === module) {
    // First two are always "Node" and the path to what was called.
    // Trash those.
    const myArgs = process.argv.slice(2);
    utils.logit("myArgs: ", myArgs);

    var karmaRunId = "unique value";
    karmaRunIds.push(karmaRunId);
    karmaRunResults[karmaRunId] = undefined;

    var configResult = {
        jsonFileParent: myArgs[0] || "./tests/fakeSite",
        allRefFilePaths: [
            "/fakeCode/add2.js",
            "/fakeCode/double.js",
            "/fakeCode/square.js",
        ],
        specFiles: [
            "/fakeCode/double.test.js",
            "/fakeTests/code.test.js",
            "/fakeTests/testSubdir/add2.test.js",
        ],
        coverageFiles: [
            "/fakeCode/add2.js",
            "/fakeCode/angular",
            "/fakeCode/double.js",
            "/fakeCode/square.js",
        ],
    };

    runWrappedKarma(configResult, karmaRunId).then(function (exitCode) {
        utils.logit("done (Promises probably outstanding)", exitCode);
    });
}

module.exports = {
    runWrappedKarma,
};
