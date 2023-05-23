/************************************************
 * Right now, this runs coverage and a pass/fail
 * test suite when exexcuted.
 ************************************************/
const karma = require("karma");

const karmaConfigTools = require("./karmaConfigTools");
const stringManipulation = require("../helpers/stringManipulation");
const utils = require("../helpers/utils");

let karmaRunIds = [];
let karmaRunResults = {};

function startKarma(karmaRunId, overrides) {
    overrides = Object.assign(
        {},
        karmaConfigTools.overridesForMochaTestingRun,
        overrides
    );
    var karmaConfig = karmaConfigTools.createKarmaConfig(overrides);

    karmaConfig.files.forEach((x, i) => {
        if (stringManipulation.isString(x) && stringManipulation.startsWithSlash(x)) {
            karmaConfig.files[i] = x.substring(1);
        } else if (
            x.pattern &&
            stringManipulation.isString(x.pattern) &&
            stringManipulation.startsWithSlash(x.pattern)
        ) {
            karmaConfig.files[i].pattern = x.pattern.substring(1);
        }
    });

    var processorKeys = Object.keys(karmaConfig.preprocessors);
    processorKeys.forEach((key) => {
        if (stringManipulation.startsWithSlash(key)) {
            karmaConfig.preprocessors[key.substring(1)] = ["coverage"];
            delete karmaConfig.preprocessors[key];
        }
    });
    // logit(karmaConfig);

    var karmaPromise = karma.config
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
                const server = new karma.Server(parsedKarmaConfig, function doneCallback(
                    exitCode
                ) {
                    // 0 is success/no test failure.
                    // Anything else is bad. Usually 1 afaict.
                    utils.debugLog("Wrapped karma has exited with " + exitCode);
                    karmaRunResults[karmaRunId] = exitCode;

                    return exitCode;
                }).on("progress", function (data) {
                    process.stdout.write(data);
                });

                var serverPromise = server.start();
                return serverPromise.then(function (x) {
                    utils.debugLog("server promise", x);
                    return x;
                });
            },
            (rejectReason) => {
                utils.debugLog("Error", rejectReason);
                throw rejectReason;
            }
        );

    return karmaPromise;
}

function runWrappedKarma(configInfo, karmaRunId) {
    // The config object gives back a collection of all refs (not tests)
    // in allRefFilePaths and the tests in specFiles.
    // karma's files property wants everything... I think...
    // So first let's put the two together.
    try {
        var allFiles = configInfo.allRefFilePaths.concat(configInfo.specFiles);
    } catch (e) {
        console.error(e);
        utils.mcDebugger();
    }
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
        // equal to {pattern: theStringPath, watched: true, served: true, included: true}
        files: allFiles,

        // everything but the tests.
        // "**/!(*test).js": ["coverage"],
        preprocessors: preprocessObj,
    };
    utils.debugLog("config overrides for karma:", overrides);

    return startKarma(karmaRunId, overrides);
}

if (require.main === module) {
    // First two are always "Node" and the path to what was called.
    // Trash those.
    const myArgs = process.argv.slice(2);
    utils.debugLog("myArgs: ", myArgs);

    var karmaRunId = "unique value";
    karmaRunIds.push(karmaRunId);
    karmaRunResults[karmaRunId] = undefined;

    if (myArgs[0]) {
        var configResult = {
            jsonFileParent: myArgs[1] || "C:\\projects\\khutzpa\\tests\\fakeSite",
            allRefFilePaths: [
                "\\fakeCode\\add2.js",
                "\\fakeCode\\double.js",
                "\\fakeCode\\square.js",
            ],
            specFiles: [
                "\\fakeCode\\double.test.js",
                "\\fakeTests\\code.test.js",
                "\\fakeTests\\testSubdir\\add2.test.js",
            ],
            coverageFiles: [
                "\\fakeCode\\add2.js",
                "\\fakeCode\\angular",
                "\\fakeCode\\double.js",
                "\\fakeCode\\square.js",
            ],
        };

        runWrappedKarma(configResult, karmaRunId).then(function (exitCode) {
            utils.debugLog("done (Promises probably outstanding)", exitCode);
        });
    } else {
        var config = {
            karmaRunId: "probably a chutzpah.json path",
            port: 9876,
            basePath: "C:\\projects\\khutzpa\\tests\\fakeSite",
            files: [
                "\\fakeCode\\add2.js",
                "\\fakeCode\\double.js",
                "\\fakeCode\\square.js",
                "\\fakeCode\\double.test.js",
                "\\fakeTests\\code.test.js",
                "\\fakeTests\\testSubdir\\add2.test.js",
            ],
            preprocessors: {
                "\\fakeCode\\add2.js": ["coverage"],
                "\\fakeCode\\angular": ["coverage"],
                "\\fakeCode\\double.js": ["coverage"],
                "\\fakeCode\\square.js": ["coverage"],
            },
        };

        // startKarma(config).then(function (after) {
        //     utils.debugLog("after", after);
        // });

        startKarma(karmaRunId, config);

        var intervalId = setInterval(function () {
            if (karmaRunIds.every((x) => karmaRunResults[x] !== undefined)) {
                utils.debugLog(karmaRunResults, "global exit codes");
                clearInterval(intervalId);
            }
        }, 2000);
    }
}

module.exports = {
    runWrappedKarma,
};
