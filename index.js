#!/usr/bin/env node

const chutzpahConfigReader = require("./services/chutzpahReader");
const specRunner = require("./services/runJasmineSpecs");
const coverageRunner = require("./services/coverage");
const server = require("./services/expressServer");
const wrappedKarma = require("./services/wrappedKarma");
const utils = require("./helpers/utils");

const prompt = require("prompt-sync")({ sigint: true });
const fs = require("fs");
const nodePath = require("node:path");
// https://github.com/domenic/opener
const opener = require("opener");
const chutzpahWalk = require("./services/chutzpahWalk");

// 1. Everything needs a read Chutzpah.json first.
// 2. Open in Browser creates a spec/runner file.
// every reference pushed into script tags in configInfoToTestRunnerScript

function cmdCallHandler(startingFilePath, expressPort, actionType) {
    var fnAction = () => {
        console.error("no action given: " + actionType);
    };

    var chutzpahConfigLocs = [startingFilePath];

    switch (actionType) {
        case actionTypes.OPEN_IN_BROWSER:
            utils.debugLog("open in browser");

            fnAction = function (configInfo) {
                return specRunner.createSpecHtml(configInfo).then(
                    (results) => {
                        var serverApp = server.startRunner(
                            nodePath.dirname(results.configFilePath),
                            results.runnerHtml
                        );

                        serverApp.listen(expressPort, function () {
                            console.log(`Example app listening on port ${expressPort}!`);
                        });

                        var handle = opener(
                            `http://localhost:${expressPort}/runner?random=false`
                        );
                        console.log(handle);

                        return 1;
                    },
                    function (err) {
                        console.error(err);
                    }
                );
            };
            break;

        case actionTypes.WITH_COVERAGE:
            utils.debugLog("coverage");
            fnAction = function (configInfo) {
                return coverageRunner.runKarmaCoverage(configInfo);
            };
            break;

        case actionTypes.RUN_ALL_CHUTZPAHS:
            utils.debugLog("run all the chutzpahs");

            console.warn("Need to undo the testing stuff here");
            chutzpahConfigLocs = chutzpahWalk.walk(startingFilePath);
            fnAction = wrappedKarma.runWrappedKarma;
            break;

        case actionTypes.FIND_ALL_CHUTZPAHS:
            utils.debugLog("FIND all the chutzpahs");

            chutzpahConfigLocs = chutzpahWalk.walk(startingFilePath);
            // Everything else returns a Promise, so when in Rome...

            fnAction = () => Promise.resolve(chutzpahConfigLocs);
            break;

        case actionTypes.WALK_ALL_RUN_ONE:
            utils.debugLog("walk all run one");
            console.log("Walking file hierarchy for Chutzpah.json files");
            chutzpahConfigLocs = chutzpahWalk.walk(startingFilePath);

            if (chutzpahConfigLocs.length) {
                var jsonLocsWithIndex = chutzpahConfigLocs.map((x, i) => `${i} -- ${x}`);
                console.log(jsonLocsWithIndex.join("\n"));
                const whichOne = prompt("Whhch do you want to run?");
                var whichIndex = parseInt(whichOne, 10);

                if (
                    (whichIndex || 0 === whichIndex) &&
                    whichIndex > -1 &&
                    whichIndex < chutzpahConfigLocs.length
                ) {
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
            fnAction = () =>
                console.log(`=================================================
khutzpa usage:
=================================================

khutzpa /path/to/root/directory /{command}

    Currently supported commands include:

    /openInBrowser
    /coverage
    /findAllSuites
    /runallSuites
    /usage`);
    }

    utils.debugLog("fnAction is set");
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

// Okay, I know, I know. enums are a code smell. mvp v1.
// https://lostechies.com/jimmybogard/2008/08/12/enumeration-classes/
var actionTypes = {
    OPEN_IN_BROWSER: 1,
    WITH_COVERAGE: 2,
    RUN_ALL_CHUTZPAHS: 3,
    FIND_ALL_CHUTZPAHS: 4,
    WALK_ALL_RUN_ONE: 5,
    PRINT_USAGE: 6,
};

if (require.main === module) {
    // First two arguments for a node process are always "Node"
    // and the path to this app. Trash those.
    const myArgs = process.argv.slice(2);
    utils.debugLog("myArgs: ", myArgs);

    var command =
        myArgs.indexOf("/openInBrowser") > -1
            ? actionTypes.OPEN_IN_BROWSER
            : myArgs.indexOf("/coverage") > -1
            ? actionTypes.WITH_COVERAGE
            : myArgs.indexOf("/findAllSuites") > -1
            ? actionTypes.FIND_ALL_CHUTZPAHS
            : myArgs.indexOf("/runAllSuites") > -1
            ? actionTypes.RUN_ALL_CHUTZPAHS
            : myArgs.indexOf("/walkAllRunOne")
            ? actionTypes.WALK_ALL_RUN_ONE
            : actionTypes.PRINT_USAGE;

    var filePath = myArgs.shift();
    utils.debugLog(command);
    if (command !== actionTypes.PRINT_USAGE && !fs.existsSync(filePath)) {
        throw `Invalid starting file ${filePath}`;
    }

    var expressPort = 3000;
    cmdCallHandler(filePath, expressPort, command).then(function (resultsIfAny) {
        utils.debugLog("done");

        if (resultsIfAny) {
            utils.debugLog("::RESULTS::");
            utils.debugLog(resultsIfAny);
            utils.debugLog("::eoRESULTS::");
        }
    });
}

module.exports = cmdCallHandler;
