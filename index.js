#!/usr/bin/env node

const chutzpahConfigReader = require("./services/chutzpahReader");
const specRunner = require("./services/runJasmineSpecs");
const coverageRunner = require("./services/coverage");
const server = require("./services/expressServer");
const wrappedKarma = require("./services/wrappedKarma");

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
            console.log("open in browser");

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
            console.log("coverage");
            fnAction = function (configInfo) {
                return coverageRunner.runKarmaCoverage(configInfo);
            };
            break;

        case actionTypes.RUN_ALL_CHUTZPAHS:
            console.log("run all the chutzpahs");

            console.warn("Need to undo the testing stuff here");
            chutzpahConfigLocs = [chutzpahWalk.walk(startingFilePath)[0]];
            fnAction = wrappedKarma.runKarmaCoverage;
            break;

        default:
            throw "Unknown command. CHECK CHOSELF.";
    }

    console.log("fnAction is set");
    return Promise.all(
        chutzpahConfigLocs.map(function (chutzpahSearchStart) {
            return chutzpahConfigReader.getConfigInfo(chutzpahSearchStart).then(
                function (results) {
                    debugger;
                    return fnAction(results);
                },
                function (err) {
                    console.error(err);
                    debugger;

                    return err;
                }
            );
        })
    );
}

// Okay, I know enums are a code smell. mvp v1.
var actionTypes = {
    OPEN_IN_BROWSER: 1,
    WITH_COVERAGE: 2,
    RUN_ALL_CHUTZPAHS: 3,
};

if (require.main === module) {
    // First two arguments for a node process are always "Node"
    // and the path to this app. Trash those.
    const myArgs = process.argv.slice(2);
    console.log("myArgs: ", myArgs);

    var filePath = myArgs.shift();
    if (!fs.existsSync(filePath)) {
        throw `Invalid starting file ${filePath}`;
    }

    var command =
        myArgs.indexOf("/openInBrowser") > -1
            ? actionTypes.OPEN_IN_BROWSER
            : myArgs.indexOf("/coverage") > -1
            ? actionTypes.WITH_COVERAGE
            : myArgs.indexOf("/runAllSuites") > -1
            ? actionTypes.RUN_ALL_CHUTZPAHS
            : "unknown";

    var expressPort = 3000;
    cmdCallHandler(filePath, expressPort, command).then(function () {
        console.log("done");
    });
}

module.exports = cmdCallHandler;
