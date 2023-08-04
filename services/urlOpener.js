// const opener = require("opener"); // opener was not opening reliably. (Cue Seinfeld)
const execSync = require("child_process").execSync;
const os = require("node:os");

function openUrl(url) {
    // this was not opening reliably on Windows.
    // possibly related: https://github.com/domenic/opener/issues/31
    // opener(coverageFilePath, undefined, function () {
    //     console.log("opener done");
    // });

    const openerCmd =
        os.platform() === "win32"
            ? `rundll32 url.dll,FileProtocolHandler ${url}`
            : `open "${url}"`;

    execSync(openerCmd, {
        encoding: "utf8",
        timeout: 10000,
    });
}

module.exports = {
    openUrl,
};
