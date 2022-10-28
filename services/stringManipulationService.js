// Okay, debated filing under utilities, not a service.
// the problem here is that regardless of if we're on windows now or not,
// the Chutzpah.json file doesn't know that. So check for both slash types
// every time.
function startsWithSlash(str) {
    return str.startsWith("/") || str.startsWith("\\");
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

module.exports = {
    removeLeadingSlashes,
    startsWithSlash,
};
