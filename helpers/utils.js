const fs = require("fs");
const { isString } = require("./stringManipulation");

const areDebugging = true;
const settingsCue = "x:";

function csvToLiteral(csv) {
    // we're not escaping commas for now.
    // csvs are fun, though. https://stackoverflow.com/a/23574271/1028230
    var values = csv.split(",");
    var literal = {};

    values.forEach((x) => (literal[x] = true));

    return literal;
}

function debugLog() {
    var args = [].slice.call(arguments);
    var settings = {};

    // this is really dumb, but it's useful-ish if I want to preserve
    // the equiv of what's left of arguments...
    if (isString(args[0])) {
        try {
            settings = args[0].startsWith(settingsCue)
                ? csvToLiteral(args[0].substring(settingsCue.length))
                : JSON.parse(args[0]);

            // only remove from args if it parsed without exception
            args.shift();

            if (settings.tofile && areDebugging) {
                args.forEach((arg) =>
                    fs.writeFileSync("./log.txt", JSON.stringify(arg, null, "  "))
                );
            }
        } catch (e) {
            // then the first arg probably wasn't settings
            // just log it.
        }
    }

    if (settings.asjson) {
        args.forEach((arg) => console.log(JSON.stringify(arg, null, "  ")));
    } else {
        console.log(...args);
    }
}

// this is just so we can make eslint shaddup.
function mcDebugger() {
    if (areDebugging) {
        // eslint-disable-next-line no-debugger
        debugger;
    }
}

module.exports = {
    debugLog,
    mcDebugger,
};
