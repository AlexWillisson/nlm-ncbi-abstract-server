"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var https_1 = __importDefault(require("https"));
var xml2js_1 = require("xml2js");
var testArticles_1 = require("./testArticles");
function fetchArticle(id) {
    var options = {
        host: 'eutils.ncbi.nlm.nih.gov',
        path: '/entrez/eutils/efetch.fcgi?db=pubmed&id=20021716&format=xml'
    };
    var callback = function (response) {
        var xml = '';
        var fetchResults = '';
        response.on('data', function (chunk) {
            xml += chunk;
        });
        response.on('end', function () {
            xml2js_1.parseString(xml, function (err, result) {
                console.log(JSON.stringify(result));
            });
        });
    };
    https_1.default.request(options, callback).end();
    return [];
}
fetchArticle(20021716);
var app = express_1.default();
var port = 3000;
app.get('/', function (req, res) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.send(JSON.stringify(testArticles_1.testArticles));
});
app.listen(port, function () {
    console.info("Ready on port " + port);
});
