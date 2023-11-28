#!/usr/bin/env node

const prompt = require("prompt-sync")({ sigint: true });
const fs = require("fs");
const portscanner = require("portscanner");

const chutzpahConfigReader = require("./services/chutzpahReader");
const specRunner = require("./services/runJasmineSpecs");
const coverageRunner = require("./services/coverage");
const server = require("./services/expressServer");
const wrappedKarma = require("./services/wrappedKarma");
const utils = require("./helpers/utils");
const packageInfo = require("./package.json");

const chutzpahWalk = require("./services/chutzpahWalk");
const { findTheRoot } = require("./helpers/findTheRoot");
const urlOpener = require("./services/urlOpener");

function printUsage() {
    console.warn(`
=================================================
khutzpa v${packageInfo.version} usage:
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
    /version
    /usage

`);

    // If you're showing usage you may have had a bogus command.
    // Chances are, if you care about return values, you don't want
    // usage shown.
    process.exit(846); // "bad"
}

function findPortNotInUseAsync() {
    return new Promise((resolve, reject) => {
        portscanner.findAPortNotInUse(3000, 3100, "127.0.0.1", function (error, port) {
            if (error) {
                reject(error);
            } else {
                resolve(port);
            }
        });
    });
}

// Note that for some actionTypes we'll do a walk to find all the configs
// first, but the default, eg, is to take the startingFilePath and look for
// the [single] closest Chutzpah.json file with no QA in this method for
// that selection.
// Note that this method DOES call chutzpahConfigReader.getConfigInfo to
// get contents for each config [whether they're from a walk or are the closest
// to the file given].
function runCommandAsync(startingFilePath, actionType, args) {
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
            utils.logit("open in browser");

            fnAction = function (khutzpaConfigInfo) {
                var allFiles = khutzpaConfigInfo.allRefFilePaths.concat(
                    khutzpaConfigInfo.specFiles
                );
                var root = findTheRoot(
                    allFiles.filter((x) => !x.toLowerCase().startsWith("http"))
                );

                return findPortNotInUseAsync().then(
                    (expressPort) => {
                        return specRunner
                            .createSpecHtml(khutzpaConfigInfo, false, root)
                            .then(
                                (results) => {
                                    var serverApp = server.startRunner(
                                        root,
                                        results.runnerHtml
                                    );

                                    serverApp.listen(expressPort, function () {
                                        utils.logit(
                                            `Example app listening on port ${expressPort}!`
                                        );
                                    });

                                    // Yes, strangely random has to be true to use a specific seed value
                                    // (making the order, um, random in a specific way? Using a specific
                                    // "random" seed? It's weird).
                                    var parsedSeed = parseInt(khutzpaConfigInfo.seed, 10);
                                    var querystring = isNaN(parsedSeed)
                                        ? `random=${!!khutzpaConfigInfo.random}`
                                        : `random=true&seed=${parsedSeed}`;

                                    var runnerUrl = `http://localhost:${expressPort}/runner?${querystring}`;
                                    urlOpener.openUrl(runnerUrl);

                                    // this prevents the process.exit call.
                                    // TODO: This is an ugly hack. Do better.
                                    return undefined;
                                },
                                function (err) {
                                    console.error(err);
                                }
                            );
                    },
                    (error) => {
                        console.error("Unable to find an open port", error);
                        throw "Unable to find an open port";
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

        case actionTypes.DEFAULT_RUN_ONE_IN_KARMA:
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
    DEFAULT_RUN_ONE_IN_KARMA: 7,
};

if (require.main === module) {
    try {
        // First two arguments for a node process are always "Node"
        // and the path to this app. Trash those.
        const myArgs = process.argv.slice(2);
        utils.logit("myArgs: ", myArgs);

        if (myArgs.indexOf("/version") > -1) {
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
                    : myArgs.indexOf("/version") > -1
                    ? actionTypes.PRINT_USAGE
                    : actionTypes.DEFAULT_RUN_ONE_IN_KARMA;

            utils.logit(command);

            runCommandAsync(filePath, command, myArgs).then(function (resultsIfAny) {
                utils.debugLog("done");

                if (
                    Array.isArray(resultsIfAny) &&
                    !resultsIfAny.every((x) => x === undefined)
                ) {
                    console.log("\n\n::RESULTS::");
                    console.log(resultsIfAny);
                    console.log("::eoRESULTS::\n\n");

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

module.exports = runCommandAsync;
