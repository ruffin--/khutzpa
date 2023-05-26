const karma = require("karma");

// For the files option:
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

const overridesForCoverage = {
    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: true,
    // singleRun: false,

    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: false,

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: "/",

    // list of files / patterns to load in the browser
    files: [{ pattern: "**/*.js", nocache: true }],

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://www.npmjs.com/search?q=keywords:karma-reporter
    // coverage reporter generates the coverage
    reporters: ["progress", "coverage"],

    // optionally, configure the reporter
    // https://github.com/karma-runner/karma-coverage/blob/HEAD/docs/configuration.md
    coverageReporter: {
        type: "html",
        dir: "coverage/",
    },
};

const overridesForMochaTestingRun = {
    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: true,

    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: "./",

    // list of files / patterns to load in the browser
    files: [{ pattern: "**/*.js" }],

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://www.npmjs.com/search?q=keywords:karma-reporter
    reporters: ["coverage", "mocha"],

    // optionally, configure the reporter
    // https://github.com/karma-runner/karma-coverage/blob/HEAD/docs/configuration.md
    coverageReporter: {
        reporters: [{ type: "text-summary" }, { type: "html", dir: "./coverage/" }],
    },
};

const createKarmaConfig = function (overrides) {
    if (!overrides) {
        overrides = overridesForCoverage;
    }

    var baseConfig = {
        // frameworks to use
        // available frameworks: https://www.npmjs.com/search?q=keywords:karma-adapter
        frameworks: ["jasmine"],

        // list of files / patterns to exclude
        exclude: ["**/node_modules/**/"],

        // preprocess matching files before serving them to the browser
        // available preprocessors: https://www.npmjs.com/search?q=keywords:karma-preprocessor
        // these should be source files, that you want to generate coverage for
        // do not include tests or libraries (these files will be instrumented by Istanbul)
        preprocessors: {
            "**/!(*test).js": ["coverage"],
        },

        // web server port
        port: 9876,

        // enable / disable colors in the output (reporters and logs)
        colors: true,

        // level of logging
        // http://karma-runner.github.io/6.4/config/configuration-file.html#loglevel
        // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
        // but see also constants
        // http://karma-runner.github.io/6.4/dev/public-api.html#constantslog_debug
        //
        // Let's go to the debugger:
        // karma.config.LOG_DEBUG
        // undefined
        // karma.constants.LOG_DEBUG
        // 'DEBUG'
        logLevel: karma.constants.LOG_WARN,
        // logLevel: karma.constants.LOG_DEBUG,

        // start these browsers
        // available browser launchers: https://www.npmjs.com/search?q=keywords:karma-launcher
        browsers: ["Chrome"],

        // Concurrency level
        // how many browser instances should be started simultaneously
        concurrency: Infinity,

        browserConsoleLogOptions: {
            level: "debug",
            format: "%b %T: %m",
            terminal: true,
        },
    };

    return Object.assign({}, baseConfig, overrides);
};

module.exports = {
    createKarmaConfig,
    overridesForCoverage,
    overridesForMochaTestingRun,
};
