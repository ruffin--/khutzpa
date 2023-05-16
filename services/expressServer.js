const express = require("express");
const app = express();
const nodePath = require("node:path");
const utils = require("../helpers/utils");

function startRunner(homeDirPath, runnerSource) {
    app.get("/home", function (req, res) {
        res.send("khutzpa home page.<br />Nothing to see here.");
    });

    app.get("/runner", function (req, res) {
        res.send(runnerSource);
    });

    app.use(
        "/jasmine",
        express.static(
            (function () {
                var root = nodePath.join(
                    __dirname,
                    "..",
                    "jasmine-standalone-4.1.1",
                    "lib",
                    "jasmine-4.1.1"
                );
                // utils.debugLog(root);
                return root;
            })()
        )
    );

    utils.debugLog("Express home dir: " + homeDirPath);
    app.use("/", express.static(homeDirPath));

    // app.listen(port, function () {
    //     utils.debugLog(`Example app listening on port ${port}!`);
    // });

    return app;
}

function startPassthrough(homeDirPath, port) {
    app.use("/", express.static(homeDirPath));
    return app;
}

module.exports = {
    startRunner,
    startPassthrough,
};
