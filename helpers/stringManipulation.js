// Okay, debated filing under utilities, not a service.
// the problem here is that regardless of if we're on windows now or not,
// the Chutzpah.json file doesn't know that. So check for both slash types
// every time.
function startsWithSlash(str) {
    return str.startsWith("/") || str.startsWith("\\");
}

function isString(x) {
    return typeof x === "string" || x instanceof String;
}

function removeLeadingSlashes(stringCollection) {
    if (!Array.isArray(stringCollection)) {
        stringCollection = [stringCollection];
    }

    return Array.isArray(stringCollection)
        ? stringCollection.map((str) => (startsWithSlash(str) ? str.substring(1) : str))
        : startsWithSlash(stringCollection)
        ? stringCollection.substring(1)
        : stringCollection;
}

// TODO: So, like, um, don't do \\\" please.
function matchesCharacterAtLocUnescaped(needle, haystack, loc) {
    // if (needle !== `"`) {
    //     utils.logit(loc + ' :: ' + needle + ' :: ' + haystack[loc]);
    // }
    return haystack[loc] === needle && (loc === 0 || haystack[loc - 1] !== "\\");
}

function stripInlineComments(payload) {
    var i = 1; // 1 is intentional.

    function increment() {
        // utils.logit(i + ' :: ' + payload[i]);
        i++;
    }

    function addToRanges(start, stop) {
        var checkedStop = stop + 1 === payload.length ? stop : stop + 1;
        // utils.logit(payload.substring(start, checkedStop));
        ranges.push([start, checkedStop]);
    }

    var ranges = [];
    var lastRangeStart = 0;
    while (i < payload.length) {
        if (matchesCharacterAtLocUnescaped(`"`, payload, i)) {
            do {
                increment();
            } while (
                i < payload.length &&
                !matchesCharacterAtLocUnescaped(`"`, payload, i)
            );
            addToRanges(lastRangeStart, i);
            lastRangeStart = ++i;
            increment();
        } else if (
            matchesCharacterAtLocUnescaped(`/`, payload, i) &&
            i + 1 < payload.length
        ) {
            increment();
            if (matchesCharacterAtLocUnescaped(`/`, payload, i)) {
                addToRanges(lastRangeStart, i - 2); // -2 to ignore // too
                // then we have a comment. Remove it.
                while (i < payload.length && ["\n", "\r"].indexOf(payload[i]) === -1) {
                    increment();
                }

                lastRangeStart = i;
            }
        } else {
            increment();
        }
    }

    addToRanges(lastRangeStart, i);
    return ranges.map((x) => payload.substring(x[0], x[1])).join("");
}

module.exports = {
    removeLeadingSlashes,
    startsWithSlash,
    isString,
    stripInlineComments,
};
