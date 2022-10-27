const fs = require("fs");
const fsPromises = fs.promises;
const nodePath = require("node:path");

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

function createSpecHtml(configInfo, writeToFile) {
    // Note that all paths from configInfo will be full paths.
    var scriptTagsToInsert = configInfoToTestRunnerScript(configInfo);

    // So I won't be using tildes in my test scripts.
    // https://github.com/nodejs/node/issues/684
    var htmlContents = specRunnerTemplate.replace("{0}", scriptTagsToInsert);

    if (writeToFile) {
        var runnerPath = nodePath.join(
            nodePath.dirname(configInfo.configFilePath),
            "runner.html"
        );
        console.log(`${htmlContents}

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

module.exports = {
    createSpecHtml,
};
