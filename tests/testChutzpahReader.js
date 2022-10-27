const configReader = require("../services/chutzpahReader");

var configPath = process.argv[2];

configReader.getConfigInfo(configPath).then((values) => {
    console.log(JSON.stringify(values, null, "  "));
    debugger;
});
