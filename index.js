#!/usr/bin/env node

const fs = require("fs");
const fsPromises = fs.promises;
const nodePath = require("node:path");
// https://github.com/domenic/opener
const opener = require("opener");
const jsonReader = require("./jsonReader");
const server = require("./expressServer");
const coverage = require("./coverage");

// https://jasmine.github.io/pages/getting_started.html
var specRunnerTemplate = `<!DOCTYPE html>
<html>
    <head>
        <meta charset="utf-8">
        <title>Jasmine Spec Runner v4.1.1</title>

        <link rel="stylesheet" href="/jasmine/jasmine.css" />

        <script src="/jasmine/jasmine.js"></script>
        <script src="/jasmine/jasmine-html.js"></script>
        <script src="/jasmine/boot0.js"></script>
        <!-- optional: include a file here that configures the Jasmine env -->
        <script src="/jasmine/boot1.js"></script>

        {0}
    </head>

    <body>
    </body>
</html>
`;

function findChutzpahJson(startPath) {
    if (!fs.existsSync(startPath)) {
        throw `Invalid start path: ${startPath}`;
    }

    // ????: Should we care about other types? Should we
    // be ready for any extension? This is kinda offensively programmed.
    var possibleDir = startPath.toLowerCase().endsWith(".js")
        ? nodePath.dirname(startPath)
        : startPath;

    var foundChutzpahJson = undefined;
    while (!foundChutzpahJson) {
        console.log("checking: " + possibleDir);
        var tryHere = nodePath.join(possibleDir, "Chutzpah.json");
        if (fs.existsSync(tryHere)) {
            foundChutzpahJson = tryHere;
        } else {
            var newPossibleDir = nodePath.dirname(possibleDir);
            if (newPossibleDir === possibleDir) {
                throw `No Chutzpah.json file found in same dir or parent: ${startPath}`;
            }
            possibleDir = newPossibleDir;
            // console.log("Next dir up: " + possibleDir);
        }
    }

    return foundChutzpahJson;
}

var scriptTemplate = `<script src="1"></script>\n`;
function configInfoToTestRunnerScript(configInfo) {
    // Create script include section for head of output page.
    var forRunner = "<!-- include source files here -->\n";

    function insertToTemplate(filePath) {
        forRunner += scriptTemplate
            .replace("1", filePath)
            // TODO: Need more than just this. Relative paths should be checked.
            // So if we're running two up and then back down, we want
            // `../../whatever/file.js`
            .replace(`src="${configInfo.jsonFileParent}`, `src="`);
    }

    configInfo.allRefFilePaths.forEach(insertToTemplate);

    forRunner += "\n\n<!-- include spec files here -->\n";
    configInfo.specFiles.forEach(insertToTemplate);

    return forRunner;
}

function createRunnerHtml(path, writeToFile) {
    var configFilePath = findChutzpahJson(path);
    console.log("Using: " + configFilePath);

    var singleTestFile = path.endsWith(".js") ? path : undefined;

    if (configFilePath) {
        return jsonReader.getConfigInfo(configFilePath, singleTestFile).then(
            (configInfo) => {
                // Note that all paths from configInfo will be full paths.
                var scriptTagsToInsert = configInfoToTestRunnerScript(configInfo);

                // So I won't be using tildes in my test scripts.
                // https://github.com/nodejs/node/issues/684
                var htmlContents = specRunnerTemplate.replace("{0}", scriptTagsToInsert);

                if (writeToFile) {
                    var runnerPath = nodePath.join(
                        nodePath.dirname(configFilePath),
                        "runner.html"
                    );
                    console.log(`${htmlContents}

#############
writing to
#############

    ${runnerPath}

`);

                    return fsPromises
                        .writeFile(runnerPath, htmlContents)
                        .then(function () {
                            return {
                                configFilePath,
                                runnerHtml: htmlContents,
                            };
                        });
                }

                return Promise.resolve({
                    configFilePath,
                    runnerHtml: htmlContents,
                });
            },
            function (err) {
                console.error(err);
            }
        );
    }

    return Promise.reject("No config file");
}

function runKarmaCoverage(path) {
    console.log("running coverage");

    var configFilePath = findChutzpahJson(path);
    console.log("Using: " + configFilePath);

    if (configFilePath) {
        return jsonReader.getConfigInfo(configFilePath, path).then((configInfo) => {
            // The config object gives back a collection of all refs (not tests)
            // in allRefFilePaths and the tests in specFiles.
            // karma files wants everything... I think... and then everything but the
            // test for the coverage preprocessor.
            // So first let's put the two together.
            var allFiles = configInfo.allRefFilePaths.concat(configInfo.specFiles);

            // Now we need an object literal with each file to cover to tell karma
            // to use the coverage preprocessor. We could use patterns, but this is
            // much more straightforward (if not efficient -- though I suspect this
            // means karma is doing less lifting and it doesn't matter).
            var preprocessObj = {};
            configInfo.coverageFiles.forEach((fileToCover) => {
                preprocessObj[fileToCover] = ["coverage"];
            });

            var overrides = {
                port: 9876,
                basePath: configInfo.basePath,
                // files: [{ pattern: "**/*.js", nocache: true }],
                // string-only is equivalent to...
                // equal to {pattern: theStringPath, watched: true, served: true, included: true}
                files: allFiles,
                // everything but the tests.
                // "**/!(*test).js": ["coverage"],
                preprocessors: preprocessObj,
            };

            console.log("config overrides for karma:", overrides);

            coverage.startKarma(overrides);
        });
    }

    return new Promise().resolve();
}

// Okay, I know this is a code smell. mvp v1.
var actionTypes = {
    OPEN_IN_BROWSER: 1,
    WITH_COVERAGE: 2,
};

function cmdCallHandler(filePath, expressPort, actionType) {
    // TODO: No, read the config first, not in the commands. Doofus.
    switch (actionType) {
        case actionTypes.OPEN_IN_BROWSER:
            console.log("open in browser");
            return createRunnerHtml(filePath).then(
                function (results) {
                    var serverApp = server.startRunner(
                        nodePath.dirname(results.configFilePath),
                        results.runnerHtml
                    );

                    serverApp.listen(expressPort, function () {
                        console.log(`Example app listening on port ${expressPort}!`);
                    });

                    var handle = opener(`http://localhost:${expressPort}/runner`);
                    console.log(handle);

                    return 1;
                },
                function (err) {
                    console.error(err);
                }
            );
            break;

        case actionTypes.WITH_COVERAGE:
            console.log("coverage");
            return runKarmaCoverage(filePath);
            break;

        default:
            throw "Unknown command. CHECK CHOSELF.";
    }
}

module.exports = cmdCallHandler;

//----------------------------
// Run Chutzpah in Chrome
//----------------------------
// '/Applications/www/khutzpa/jasmine-standalone-4.1.1/spec/PlayerSpec.js',
// '/engine',
// 'chrome',
// '/browserArgs',
// '--disable-web-security --user-data-dir=C:/ChromeDevSession',
// '/openInBrowser',
// 'chrome',
// '/trace',
// '/debug'
// ]

//----------------------------
// Run Chutzpah with coverage
//----------------------------
// "path/to/folder/or/file/selected"
// /engine chrome
// /coverage
// /coveragehtml
// /var/folders/ry/9v79xg1j7n9fzdfygqmb4q180000gp/T/coverage-q61CXV.html
// /trace
// /debug
if (require.main === module) {
    // First two are always "Node" and the path to this app.
    // Trash those.
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
