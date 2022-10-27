const nodePath = require("node:path");
const jsonReader = require("../jsonReader");

var testCount = 0;

// let's hack a quick, one-level only beforeEach.
var fnBeforeEach = () => undefined;

var describe = function (desc, func) {
    console.log(desc);
    fnBeforeEach = () => undefined; // right now only one set a time
    func();
};

var it = function (desc, func) {
    fnBeforeEach();

    // Not so great for async tests.
    console.log(`${++testCount}: ${desc}`);
    func();
};

var beforeEach = function (fn) {
    var oldVal = fnBeforeEach;

    fnBeforeEach = function () {
        oldVal();
        fn();
    };
};

var expect = function (actual) {
    return {
        toBe: function (expected) {
            if (expected !== actual) {
                throw `${actual} is not equal to ${expected}`;
            } else {
                console.log(`${actual} does equal ${expected}. Good on you.`);
            }
        },
    };
};

describe("when chutzpah.json path is found", function () {
    describe("and getConfigInfo is called it", function () {
        var filePath;
        var appHome;

        beforeEach(function () {
            appHome = nodePath.dirname(process.mainModule.filename);
            filePath = nodePath.join(appHome, "./fakeSite/Chutzpah.json");
        });

        it("should return a truthy object info", function () {
            // Act
            jsonReader.getConfigInfo(filePath).then(function (configInfo) {
                console.log("\n\nsample jsonconfig results\n\n");
                console.log(configInfo);

                // Assert
                expect(!!configInfo).toBe(true);
            });
        });

        it("should return the correct number of ref files", function () {
            // Act
            jsonReader.getConfigInfo(filePath).then(function (configInfo) {
                console.log("\n\nsample jsonconfig results\n\n");
                console.log(configInfo);

                // Assert
                // Two code files
                expect(configInfo.allRefFilePaths.length).toBe(2);
            });
        });

        it("should return the correct number of spec files", function () {
            // Act
            jsonReader.getConfigInfo(filePath).then(function (configInfo) {
                console.log("\n\nsample jsonconfig results\n\n");
                console.log(configInfo);

                // Assert
                // Two code files
                expect(configInfo.allRefFilePaths.length).toBe(2);
            });
        });

        it("should return the correct number of coverage files", function () {
            // Act
            jsonReader.getConfigInfo(filePath).then(function (configInfo) {
                console.log("\n\nsample jsonconfig results\n\n");
                console.log(configInfo);

                // Assert
                // Two code files
                expect(configInfo.allRefFilePaths.length).toBe(2);
            });
        });
    });
});
