/************************************************
 * Right now, this runs coverage and a pass/fail
 * test suite when exexcuted.
 ************************************************/
const karma = require("karma");
const stringManipulation = require("./stringManipulationService");

let karmaRunIds = [];
let karmaRunResults = {};

function logit(x) {
    // console.log(JSON.stringify(x, null, "  "));
}

const createKarmaConfig = function (overrides) {
    var baseConfig = {
        // base path that will be used to resolve all patterns (eg. files, exclude)
        basePath: "./",

        // frameworks to use
        // available frameworks: https://www.npmjs.com/search?q=keywords:karma-adapter
        frameworks: ["jasmine"],

        // list of files / patterns to load in the browser
        files: [{ pattern: "**/*.js" }],

        // list of files / patterns to exclude
        exclude: ["**/node_modules/**/"],

        // preprocess matching files before serving them to the browser
        // available preprocessors: https://www.npmjs.com/search?q=keywords:karma-preprocessor
        // preprocessors: {},
        preprocessors: {
            "**/!(*test).js": ["coverage"],
            // './fakeCode/add2.js': ['coverage'],
        },

        // test results reporter to use
        // possible values: 'dots', 'progress'
        // available reporters: https://www.npmjs.com/search?q=keywords:karma-reporter
        reporters: ["coverage", "mocha"],
        // reporters: ['progress', 'coverage'],

        // https://github.com/karma-runner/karma-coverage/blob/HEAD/docs/configuration.md
        coverageReporter: {
            reporters: [
                { type: "text-summary" },
                { type: "html", dir: "../coverage/" },
                { type: "text", dir: "coverage/", file: "coverage.txt" },
            ],
        },

        // web server port
        port: 9876,

        // enable / disable colors in the output (reporters and logs)
        colors: true,

        // level of logging
        // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
        logLevel: karma.config.LOG_DEBUG,

        // enable / disable watching file and executing tests whenever any file changes
        autoWatch: true,

        // start these browsers
        // available browser launchers: https://www.npmjs.com/search?q=keywords:karma-launcher
        browsers: ["Chrome"],

        // Continuous Integration mode
        // if true, Karma captures browsers, runs the tests and exits
        singleRun: true,

        // Concurrency level
        // how many browser instances should be started simultaneously
        concurrency: Infinity,
    };

    return Object.assign({}, baseConfig, overrides);
};

function startKarma(karmaRunId, overrides) {
    var karmaConfig = createKarmaConfig(overrides);
    // logit(karmaConfig);

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
                    console.log("Karma has exited with " + exitCode);
                    karmaRunResults[karmaRunId] = exitCode;

                    return exitCode;
                }).on("progress", function (data) {
                    process.stdout.write(data);
                });

                var serverPromise = server.start();
                return serverPromise.then(function (x) {
                    console.log("server promise", x);
                    return x;
                });
            },
            (rejectReason) => {
                console.log("Error", rejectReason);
                throw rejectReason;
            }
        );

    return karmaPromise;
}

function runFullTests(configInfo, karmaRunId) {
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

        // files: [{ pattern: "**/*.js", nocache: true }], // NOTE: nocache true breaks the coverage reporter.
        // string-only is equivalent to...
        // equal to {pattern: theStringPath, watched: true, served: true, included: true}
        files: allFiles,

        // everything but the tests.
        // "**/!(*test).js": ["coverage"],
        preprocessors: preprocessObj,
    };
    logit("config overrides for karma:", overrides);

    return startKarma(karmaRunId, overrides);
}

if (require.main === module) {
    // First two are always "Node" and the path to what was called.
    // Trash those.
    const myArgs = process.argv.slice(2);
    logit("myArgs: ", myArgs);

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

        runFullTests(configResult, karmaRunId).then(function (exitCode) {
            console.log("done (Promises probably outstanding)", exitCode);
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
        //     console.log("after", after);
        // });

        startKarma(karmaRunId, config);

        // TODO: Turn into a Promise.
        var intervalId = setInterval(function () {
            if (karmaRunIds.every((x) => karmaRunResults[x] !== undefined)) {
                console.log(karmaRunResults, "global exit codes");
                clearInterval(intervalId);
            }
        }, 2000);
    }
}

module.exports = {
    runFullTests,
};
