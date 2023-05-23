module.exports = function (config) {
    config.set(data);
};

var data = 
{
  "singleRun": true,
  "autoWatch": false,
  "basePath": "C:\\projects\\khutzpa\\tests\\fakeSite",
  "files": [
    "./fakeCode/add2.js",
    "./fakeCode/double.js",
    "./fakeCode/square.js",
    "./fakeCode/double.test.js",
    "./fakeTests/code.test.js",
    "./fakeTests/testSubdir/add2.test.js",
    "./karma.test.js"
  ],
  "preprocessors": {
    "./fakeCode/add2.js": [
      "coverage"
    ],
    "./fakeCode/double.js": [
      "coverage"
    ],
    "./fakeCode/square.js": [
      "coverage"
    ]
  },
  "frameworks": [
    "jasmine"
  ],
  "reporters": [
    "progress",
    "coverage"
  ],
  "coverageReporter": {
    "type": "html",
    "dir": "coverage/"
  },
  "port": 9876,
  "colors": true,
  "logLevel": "DEBUG",
  "browsers": [
    "Chrome"
  ],
  "concurrency": null,
  "browserConsoleLogOptions": {
    "level": "debug",
    "format": "%b %T: %m",
    "terminal": true
  }
};
