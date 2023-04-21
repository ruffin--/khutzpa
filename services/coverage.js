const karma = require("karma");
const Server = karma.Server;
const fs = require("fs");
const nodePath = require("node:path");
const opener = require("opener");
const expressServer = require("./expressServer");
const stringManipulation = require("./stringManipulationService");

const createKarmaConfig = function (overrides) {
    var baseConfig = {
        // Continuous Integration mode
        // if true, Karma captures browsers, runs the tests and exits
        singleRun: true,
        // singleRun: false,

        // enable / disable watching file and executing tests whenever any file changes
        autoWatch: false,

        basePath: "/",
        files: [{ pattern: "**/*.js", nocache: true }],
        // exclude: ["**/External/**/*.js"],
        // available preprocessors: https://www.npmjs.com/search?q=keywords:karma-preprocessor
        // these should be source files, that you want to generate coverage for
        // do not include tests or libraries (these files will be instrumented by Istanbul)
        preprocessors: {
            "**/!(*test).js": ["coverage"],
        },

        // ========================================================
        // End of stuff we'd typically change per run ^^^^
        // ========================================================

        // available frameworks: https://www.npmjs.com/search?q=keywords:karma-adapter
        frameworks: ["jasmine"],

        // test results reporter to use
        // possible values: 'dots', 'progress'
        // available reporters: https://www.npmjs.com/search?q=keywords:karma-reporter
        // coverage reporter generates the coverage
        reporters: ["progress", "coverage"],

        // optionally, configure the reporter
        coverageReporter: {
            type: "html",
            dir: "coverage/",
        },

        // web server port
        port: 9876,
        // enable / disable colors in the output (reporters and logs)
        colors: true,
        // level of logging
        // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
        logLevel: karma.constants.LOG_DEBUG,

        // available browser launchers: https://www.npmjs.com/search?q=keywords:karma-launcher
        browsers: ["Chrome"],

        // Concurrency level
        // how many browser instances should be started simultaneously
        concurrency: Infinity,
        browserConsoleLogOptions: { level: "debug", format: "%b %T: %m", terminal: true },
    };

    return Object.assign({}, baseConfig, overrides);
};

function logit(x) {
    console.log(JSON.stringify(x, null, "  "));
}

/*
http://karma-runner.github.io/6.4/config/files.html#complete-example
files: [

  // Detailed pattern to include a file. Similarly other options can be used
  { pattern: 'lib/angular.js', watched: false },
  // Prefer to have watched false for library files. No need to watch them for changes

  // simple pattern to load the needed testfiles
  // equal to {pattern: 'test/unit/*.spec.js', watched: true, served: true, included: true}
  'test/unit/*.spec.js',

  // this file gets served but will be ignored by the watcher
  // note if html2js preprocessor is active, reference as `window.__html__['compiled/index.html']`
  {pattern: 'compiled/index.html', watched: false},

  // this file only gets watched and is otherwise ignored
  {pattern: 'app/index.html', included: false, served: false},

  // this file will be served on demand from disk and will be ignored by the watcher
  {pattern: 'compiled/app.js.map', included: false, served: true, watched: false, nocache: true}
],
*/
function startKarma(overrides) {
    var serverHasStarted = false;
    var karmaConfig = createKarmaConfig(overrides);
    logit(karmaConfig);

    karmaConfig.files.forEach((x, i) => {
        if (stringManipulation.startsWithSlash(x)) {
            karmaConfig.files[i] = x.substring(1);
        }
    });

    var processorKeys = Object.keys(karmaConfig.preprocessors);
    processorKeys.forEach((key) => {
        if (stringManipulation.startsWithSlash(key)) {
            karmaConfig.preprocessors[key.substring(1)] = ["coverage"];
            delete karmaConfig.preprocessors[key];
        }
    });
    logit(karmaConfig);

    return karma.config
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
                    console.log("Karma has exited with " + exitCode);
                    console.log(arguments);

                    var coverageDir = nodePath.join(karmaConfig.basePath, "coverage");

                    fs.readdir(coverageDir, function (err, list) {
                        var latestCoverageDir = "";
                        var latestTime = 0;
                        console.log(list, err);

                        list.forEach((file) => {
                            // TODO: Change when we have other browsers, natch.
                            if (file.indexOf("Chrome") > -1) {
                                var fullPath = nodePath.join(coverageDir, file);
                                var statsObj = fs.statSync(fullPath);
                                if (statsObj.isDirectory()) {
                                    console.log(`
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
                            console.log(latestCoverageDir);

                            // TODO: Figure out why doneCallback is getting called twice.
                            if (!serverHasStarted) {
                                serverHasStarted = true;
                                var serverApp =
                                    expressServer.startPassthrough(latestCoverageDir);

                                var expressPort = 3000;
                                serverApp.listen(expressPort, function () {
                                    console.log(
                                        `Example app listening on port ${expressPort}!`
                                    );
                                });

                                var handle = opener(
                                    `http://localhost:${expressPort}/index.html`
                                );
                                console.log("handle pid: " + handle.pid);
                            }
                        } else {
                            console.warn("No coverage directory found!");
                        }
                    });

                    // process.exit(exitCode);
                });

                server.start();
            },
            (rejectReason) => {
                /* respond to the rejection reason error */
                console.log("Error", rejectReason);
            }
        );
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

    console.log("config overrides for karma:", overrides);

    return startKarma(overrides);
}

if (require.main === module) {
    // First two are always "Node" and the path to what was called.
    // Trash those.
    const myArgs = process.argv.slice(2);
    console.log("myArgs: ", myArgs);

    var basePath = myArgs[0];

    startKarma(basePath).then(function () {
        console.log("done");
    });
}

module.exports = {
    runKarmaCoverage,
};
