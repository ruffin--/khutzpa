const fs = require("fs");
const { isString } = require("./stringManipulation");

const settingsCue = "x:";

let areDebugging = false;
let logLevel = 50;
let logAllToFile = false;

function csvToLiteral(csv) {
    // we're not escaping commas for now.
    // csvs are fun, though. https://stackoverflow.com/a/23574271/1028230
    var values = csv.split(",");
    var literal = {};
    var ignore = [];

    values.forEach((x, i) => {
        if (ignore.indexOf(i) === -1) {
            switch (x) {
                case "logLevel":
                    literal[x] = parseInt(values[i + 1], 10);
                    ignore.push(i + 1);
                    break;
                default:
                    literal[x] = true;
            }
        }
    });

    return literal;
}

// https://stackoverflow.com/a/20392392/1028230
// If you don't care about primitives and only objects then this function
// is for you, otherwise look elsewhere.
// This function will return `false` for any valid json primitive.
// EG, 'true' -> false
//     '123' -> false
//     'null' -> false
//     '"I'm a string"' -> false
function isParseable(jsonString) {
    try {
        var o = JSON.parse(jsonString);

        // Handle non-exception-throwing cases:
        // Neither JSON.parse(false) or JSON.parse(1234) throw errors, hence the type-checking,
        // but... JSON.parse(null) returns null, and typeof null === "object",
        // so we must check for that, too. Thankfully, null is falsey, so this suffices:
        if (o && typeof o === "object") {
            return o;
        }
    } catch (e) {
        // ain't json
    }

    return false;
}

// yes, we lose the settings hack here.
function alwaysLog() {
    debugLog(`${settingsCue}alwaysLog`, ...arguments);
}

function log50() {
    debugLog(`${settingsCue}logLevel,50`, ...arguments);
}

function debugLog() {
    var args = [].slice.call(arguments);
    // eslint-disable-next-line
    var settings = logAllToFile
        ? // eslint-disable-next-line
          {
              tofile: true,
          }
        : {};

    // this is really dumb, but it's useful-ish if I want to preserve
    // the equiv of what's left of arguments...
    if (isString(args[0]) || settings.tofile) {
        try {
            // why in heavens name is the first arg for settings
            // have to be a json string and not an object literal?
            // what in the world was your plan here? sheesh. ;)
            var wasParseable = isParseable(args[0]);
            settings = args[0].startsWith(settingsCue)
                ? csvToLiteral(args[0].substring(settingsCue.length))
                : wasParseable
                ? Object.assign(settings, wasParseable)
                : settings;

            // Now throw away the settings so we don't log it.
            if (wasParseable || args[0].startsWith(settingsCue)) {
                args.shift();
            }

            if (settings.tofile) {
                args.forEach((arg) =>
                    fs.appendFileSync(
                        "./log.txt",
                        `${Date().toString()}:: ${
                            isString(arg) ? arg : JSON.stringify(arg, null, "  ")
                        }\n`
                    )
                );
            }
        } catch (e) {
            // then the first arg probably wasn't settings
            // just log it.
        }
    }

    if (settings.logLevel >= logLevel || logLevel === 0 || settings.alwaysLog) {
        if (settings.asjson || args.length === 1) {
            args.forEach((arg) =>
                console.log(isString(arg) ? arg : JSON.stringify(arg, null, "  "))
            );
        } else {
            console.log(...args);
        }
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
    log50,
    alwaysLog,
    mcDebugger,
    isParseable,
    areDebugging,
    logLevel,
    logAllToFile,
};
