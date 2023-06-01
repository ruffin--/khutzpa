#!/usr/bin/env node

const prompt = require("prompt-sync")({ sigint: true });
const fs = require("fs");

const chutzpahConfigReader = require("./services/chutzpahReader");
const specRunner = require("./services/runJasmineSpecs");
const coverageRunner = require("./services/coverage");
const server = require("./services/expressServer");
const wrappedKarma = require("./services/wrappedKarma");
const utils = require("./helpers/utils");

// https://github.com/domenic/opener
const opener = require("opener");
const chutzpahWalk = require("./services/chutzpahWalk");
const { findTheRoot } = require("./helpers/findTheRoot");

function printUsage() {
    console.warn(`
=================================================
khutzpa usage:
=================================================

khutzpa /path/to/root/directory /{command}

    A path *must* be included.

    Currently supported commands include:

    /openInBrowser
    /coverage
    /runAllSuites
    /runOne
    /findAllSuites
    /walkAllRunOne
    /usage

`);
}

function cmdCallHandler(startingFilePath, expressPort, actionType, args) {
    var fnAction = () => {
        console.error("no action given: " + actionType);
    };

    var chutzpahConfigLocs = [startingFilePath];

    // most of the time, we'll be running a set of async operations on
    // the chutzpah contents of each applicable chutzpah config; thus the default.
    // But see below where sometimes we return a static value directly.
    var runEachPromise = true;
    var staticPayload = {};

    switch (actionType) {
        case actionTypes.OPEN_IN_BROWSER:
            utils.debugLog("open in browser");

            fnAction = function (configInfo) {
                var allFiles = configInfo.allRefFilePaths.concat(configInfo.specFiles);
                var root = findTheRoot(allFiles);

                return specRunner.createSpecHtml(configInfo, false, root).then(
                    (results) => {
                        var serverApp = server.startRunner(root, results.runnerHtml);

                        serverApp.listen(expressPort, function () {
                            utils.debugLog(
                                `Example app listening on port ${expressPort}!`
                            );
                        });

                        var handle = opener(
                            `http://localhost:${expressPort}/runner?random=false`
                        );
                        utils.debugLog(handle);

                        // this prevents the process.exit call.
                        // TODO: This is an ugly hack. Do better.
                        return undefined;
                    },
                    function (err) {
                        console.error(err);
                    }
                );
            };
            break;

        case actionTypes.WITH_COVERAGE:
            utils.debugLog("coverage");

            var outFile;
            var indexOfPath = args.indexOf("/coveragehtml");

            if (indexOfPath !== -1) {
                outFile = args[indexOfPath + 1];
            }

            fnAction = function (configInfo) {
                return coverageRunner.runKarmaCoverage(configInfo, outFile);
            };
            break;

        case actionTypes.RUN_ALL_CHUTZPAHS:
            utils.debugLog("run all the chutzpahs");

            chutzpahConfigLocs = chutzpahWalk.walk(startingFilePath);
            fnAction = wrappedKarma.runWrappedKarma;
            break;

        case actionTypes.FIND_ALL_CHUTZPAHS:
            utils.debugLog("FIND all the chutzpahs but don't run them");
            staticPayload = chutzpahWalk.walk(startingFilePath);
            runEachPromise = false;
            break;

        case actionTypes.RUN_ONE_IN_KARMA:
            // note that this (and other walk-less actions) uses
            // chutzpahConfigLocs = [startingFilePath];
            // instead of the results of a walk.
            utils.debugLog("Run one in karma");
            fnAction = wrappedKarma.runWrappedKarma;
            break;

        case actionTypes.WALK_ALL_RUN_ONE:
            utils.debugLog("walk all run one");
            chutzpahConfigLocs = chutzpahWalk.walk(startingFilePath);

            if (chutzpahConfigLocs.length) {
                var jsonLocsWithIndex = chutzpahConfigLocs.map((x, i) => `${i} -- ${x}`);
                console.log(jsonLocsWithIndex.join("\n"));
                const whichOne = prompt("Which do you want to run?");
                var whichIndex = parseInt(whichOne, 10);

                if (
                    (whichIndex || 0 === whichIndex) &&
                    whichIndex > -1 &&
                    whichIndex < chutzpahConfigLocs.length
                ) {
                    utils.debugLog("Running config index: " + whichIndex);
                    chutzpahConfigLocs = [chutzpahConfigLocs[whichIndex]];
                    fnAction = wrappedKarma.runWrappedKarma;
                } else {
                    console.warn("Invalid index selected.");
                    process.exit();
                }
            } else {
                console.warn("No Chutzpah files found.");
                process.exit();
            }
            break;

        default:
            fnAction = printUsage;
    }

    utils.debugLog("fnAction is set");
    if (runEachPromise) {
        return Promise.all(
            chutzpahConfigLocs.map(function (chutzpahSearchStart) {
                return chutzpahConfigReader.getConfigInfo(chutzpahSearchStart).then(
                    function (configContents) {
                        return fnAction(configContents, chutzpahSearchStart);
                    },
                    function (err) {
                        console.error(err, chutzpahSearchStart);
                        return err;
                    }
                );
            })
        );
    }

    return Promise.resolve(staticPayload);
}
// eo cmdCallHandler

// Okay, I know, I know. enums are a code smell. mvp v1.
// https://lostechies.com/jimmybogard/2008/08/12/enumeration-classes/
var actionTypes = {
    OPEN_IN_BROWSER: 1,
    WITH_COVERAGE: 2,
    RUN_ALL_CHUTZPAHS: 3,
    FIND_ALL_CHUTZPAHS: 4,
    WALK_ALL_RUN_ONE: 5,
    PRINT_USAGE: 6,
    RUN_ONE_IN_KARMA: 7,
};

if (require.main === module) {
    try {
        // First two arguments for a node process are always "Node"
        // and the path to this app. Trash those.
        const myArgs = process.argv.slice(2);
        utils.debugLog("myArgs: ", myArgs);

        if (myArgs.indexOf("/version") > -1) {
            const packageInfo = require("./package.json");
            return console.log(packageInfo.version);
        }

        var filePath = myArgs.shift();
        if (!filePath || !fs.existsSync(filePath)) {
            printUsage();
        } else {
            var command =
                myArgs.indexOf("/openInBrowser") > -1
                    ? actionTypes.OPEN_IN_BROWSER
                    : myArgs.indexOf("/coverage") > -1
                    ? actionTypes.WITH_COVERAGE
                    : myArgs.indexOf("/findAllSuites") > -1
                    ? actionTypes.FIND_ALL_CHUTZPAHS
                    : myArgs.indexOf("/runAllSuites") > -1
                    ? actionTypes.RUN_ALL_CHUTZPAHS
                    : myArgs.indexOf("/walkAllRunOne") > -1
                    ? actionTypes.WALK_ALL_RUN_ONE
                    : myArgs.indexOf("/runOne") > -1
                    ? actionTypes.RUN_ONE_IN_KARMA
                    : actionTypes.PRINT_USAGE;

            utils.debugLog(command);

            var expressPort = 3000;
            cmdCallHandler(filePath, expressPort, command, myArgs).then(function (
                resultsIfAny
            ) {
                utils.debugLog("done");

                if (
                    Array.isArray(resultsIfAny) &&
                    !resultsIfAny.every((x) => x === undefined)
                ) {
                    console.log("::RESULTS::");
                    console.log(resultsIfAny);
                    console.log("::eoRESULTS::");

                    const firstError = resultsIfAny.find((x) => x && x !== 0);

                    // On Windows, to see the returned code (https://stackoverflow.com/a/334893/1028230):
                    // cmd.exe: echo %ERRORLEVEL%
                    // pwsh.exe: echo $LastExitCode
                    process.exit(firstError || 0);
                }
            });
        }
    } catch (e) {
        console.error("An error occurred:", e);
    }
}

module.exports = cmdCallHandler;
