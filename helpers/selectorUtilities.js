const minimatch = require("minimatch");
const nodePath = require("node:path");
const utils = require("./utils");

// We have two competing issues here...
// A. *.js style globs only match files in the root dir.
// B. minimatch always fails to match ../s in paths.
//      Treatise on glob "standards":
//          https://github.com/isaacs/minimatch/issues/30#issuecomment-1040599045
//      (It looked like optimizationLevel:2 would change that, but it doesn't.)
//      (Appears that's b/c you're using v5, not v7+)
//      https://github.com/isaacs/minimatch/blob/main/changelog.md
// That means B. wants full paths, but A doesn't want a full path appended.
// That conflict makes it tough to use paths as single strings.
// Full path doesn't work A & B. Hacks are hard to match back up.
function hasRelativeOrFullPathMatch(fullPath, home, glob) {
    var relative = nodePath.relative(home, fullPath);
    var valueForDebugging = minimatch(relative, glob) || minimatch(fullPath, glob);
    return valueForDebugging;
}

function minimatchEngine(selector, fullPaths, home, selectorName) {
    var allMatches = [];

    selectorName = selectorName || "Includes";

    // TODO: You may also need to solve the asterisk interpretation issue.
    // https://github.com/mmanela/chutzpah/wiki/tests-setting#example
    // { "Includes": ["*test1*"] },
    // "Includes all tests that contain test1 in its path. This is in glob format."
    //  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    // If that's accurate, that's not how globs work *in the minimatch package*.
    // (See excellent treatise on glob "standards", above.)
    //
    // Recall that minimatch really wants you to use full paths.
    // See: `partial` option in minimatch, eg:
    // https://github.com/isaacs/minimatch#partial
    // "This is useful in applications where you're walking through a folder structure, and don't yet have the full path..."
    // This means that if we stop using full paths, you'll need to revisit starting slash usage.
    selector[selectorName].forEach(function (includePattern) {
        var matches = fullPaths.filter((singleFullPath) =>
            hasRelativeOrFullPathMatch(singleFullPath, home, includePattern)
        );

        // I feel like this dedupe is a painfully inefficient operation.
        allMatches = allMatches.concat(
            matches.filter((x) => allMatches.indexOf(x) === -1)
        );
    });

    return allMatches;
}

var findAllIncludes = function (selector, fullPaths, home) {
    normalizeIncludeVsIncludes(selector);
    utils.debugLog("includes", selector.Includes);
    return minimatchEngine(selector, fullPaths, home, "Includes");
};

var removeAllExcludes = function (selector, fullPaths, home) {
    normalizeExcludeVsExcludes(selector);
    utils.debugLog("Excludes", selector.Excludes);

    var excludes = minimatchEngine(selector, fullPaths, home, "Excludes");
    return fullPaths.filter((includePath) => excludes.indexOf(includePath) === -1);
};

var normalizeExcludeVsExcludes = function (selector) {
    if (selector.Exclude && !selector.Excludes) {
        selector.Excludes = selector.Exclude;
        delete selector.Exclude;
    }

    if (!selector.Excludes) {
        selector.Excludes = [];
    }
    if (!Array.isArray(selector.Excludes)) {
        selector.Excludes = [selector.Excludes];
    }
};

var normalizeIncludeVsIncludes = function (selector) {
    // TODO: The Chutzpah docs say these are both plural,
    // but I'm seeing json files with, eg, Include instead of
    // Includes.
    // https://github.com/mmanela/chutzpah/wiki/references-setting
    //
    // Same with excludes, above.
    //
    // I'm not supporting both; this privileges Include singular over
    // Includes plural, erasing plural if singular exists. Is that smart?
    //
    // Also, if a selector doesn't exist, should we return everything?
    // (Probably so? Maybe not? That's what we're doing now.)
    if (selector.Include && !selector.Includes) {
        selector.Includes = selector.Include;
        delete selector.Include;
    }
    if (!selector.Includes) {
        selector.Includes = [];
    }
    if (!Array.isArray(selector.Includes)) {
        selector.Includes = [selector.Includes];
    }
};

module.exports = {
    findAllIncludes,
    removeAllExcludes,
    normalizeExcludeVsExcludes,
    normalizeIncludeVsIncludes,
};
