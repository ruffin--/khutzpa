const fs = require("fs");
const fsPromises = fs.promises;
const nodePath = require("node:path");

const utils = require("../helpers/utils");

// https://jasmine.github.io/pages/getting_started.html
const scriptTemplate = `<script src="1"></script>\n`;
const specRunnerTemplate = `<!DOCTYPE html>
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

function createSpecHtml(configInfo, writeToFile, root) {
    // Note that all paths from configInfo will be full paths.
    var scriptTagsToInsert = configInfoToTestRunnerScript(configInfo, root);

    // So I won't be using tildes in my test scripts.
    // https://github.com/nodejs/node/issues/684
    var htmlContents = specRunnerTemplate.replace("{0}", scriptTagsToInsert);

    if (writeToFile) {
        var runnerPath = nodePath.join(root, "runner.html");
        utils.debugLog(`${htmlContents}

#############
writing to
#############

    ${runnerPath}

`);

        return fsPromises.writeFile(runnerPath, htmlContents).then(function () {
            return {
                configFilePath: configInfo.configFilePath,
                runnerHtml: htmlContents,
            };
        });
    }

    return Promise.resolve({
        configFilePath: configInfo.configFilePath,
        runnerHtml: htmlContents,
    });
}

function configInfoToTestRunnerScript(configInfo, root) {
    // Create script include section for head of output page.
    var forRunner = "<!-- include source files here -->\n";

    function insertToTemplate(filePath) {
        if (filePath.indexOf("jasmine") > -1 && filePath.endsWith(".js")) {
            console.warn(`
!!!!!! ${filePath}
contains the characters "jasmine". khutzpa provides its own version of jasmine.
Referencing another version of jasmine can break tests. Currently skipping this file.
Note: There is currently no way to override this check.

TODO: Allow overriding this check.`);
        } else {
            forRunner += scriptTemplate.replace("1", nodePath.relative(root, filePath));
        }
    }

    configInfo.allRefFilePaths.forEach(insertToTemplate);

    forRunner += "\n\n<!-- include spec files here -->\n";
    configInfo.specFiles.forEach(insertToTemplate);

    return forRunner;
}

// TODO: Remove integration testing so we can remove these two requires.
const fileSystemService = require("./fileSystemService");
const chutzpahReader = require("./chutzpahReader");

if (require.main === module) {
    // First two are always "Node" and the path to what was called.
    // Trash those.
    const myArgs = process.argv.slice(2);
    utils.debugLog("myArgs: ", myArgs);

    fileSystemService.getFileContents("C:\\temp\\chutzpahTestValues.json").then(
        (testValueFileContents) => {
            var testConfigPath = JSON.parse(testValueFileContents).singleChutzpah;

            fileSystemService.getFileContents(testConfigPath).then(
                chutzpahReader.getConfigInfo(testConfigPath).then(
                    (values) => {
                        createSpecHtml(values, !"don't write to a file").then((html) => {
                            utils.debugLog(html.runnerHtml);
                        });
                    },
                    (err) => console.error("2", err)
                ),
                (err) => console.error("1", err)
            );
        },
        (err) => console.error("0", err)
    );
}

module.exports = {
    createSpecHtml,
};
