#!/usr/bin/env node

const chutzpahConfigReader = require("./services/chutzpahReader");
const specRunner = require("./services/runJasmineSpecs");
const coverageRunner = require("./services/coverage");
const server = require("./services/expressServer");

const nodePath = require("node:path");
// https://github.com/domenic/opener
const opener = require("opener");

function cmdCallHandler(startingFilePath, expressPort, actionType) {
    return chutzpahConfigReader.getConfigInfo(startingFilePath).then((configInfo) => {
        switch (actionType) {
            case actionTypes.OPEN_IN_BROWSER:
                console.log("open in browser");
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

            case actionTypes.WITH_COVERAGE:
                console.log("coverage");
                return coverageRunner.runKarmaCoverage(startingFilePath);

            default:
                throw "Unknown command. CHECK CHOSELF.";
        }
    });
}

// Okay, I know enums are a code smell. mvp v1.
var actionTypes = {
    OPEN_IN_BROWSER: 1,
    WITH_COVERAGE: 2,
};

if (require.main === module) {
    // First two arguments for a node process are always "Node"
    // and the path to this app. Trash those.
    const myArgs = process.argv.slice(2);
    console.log("myArgs: ", myArgs);

    var filePath = myArgs[0];

    var command =
        myArgs.indexOf("/openInBrowser") > -1
            ? actionTypes.OPEN_IN_BROWSER
            : myArgs.indexOf("/coverage") > -1
            ? actionTypes.WITH_COVERAGE
            : "unknown";

    var expressPort = 3000;
    cmdCallHandler(filePath, expressPort, command).then(function () {
        console.log("done");
    });
}

module.exports = cmdCallHandler;
