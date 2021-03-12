"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var node_fetch_1 = __importDefault(require("node-fetch"));
var testArticles_1 = require("./testArticles");
var articles_1 = require("./articles");
function fetchArticles(ids) {
    var splitByType = {};
    var types = [];
    ids.forEach(function (article) {
        if (article.type in splitByType === false) {
            types.push(article.type);
            splitByType[article.type] = [];
        }
        splitByType[article.type].push(article.id);
    });
    var collectedArticles = [];
    types.forEach(function (type) {
        var articles = fetchArticlesPerDb(type, splitByType[type]);
        collectedArticles = collectedArticles.concat(articles);
    });
    return collectedArticles;
}
function fetchArticlesPerDb(db, ids) {
    var params = {
        db: db,
        format: 'xml',
        id: ids.join(',')
    };
    var query = new URLSearchParams(params);
    node_fetch_1.default("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?" + query.toString())
        .then(function (res) { return res.text(); })
        .then(function (body) {
        console.log(body);
    });
    return [];
    // let path = '/entrez/eutils/efetch.fcgi?' 
    // let options = {
    //     host: 'eutils.ncbi.nlm.nih.gov',
    //     path: path
    // };
    // let callback = function (response: http.IncomingMessage) {
    //     var xml = '';
    //     var fetchResults = '';
    //     response.on('data', function (chunk) {
    //         xml += chunk;
    //     });
    //     response.on('end', function () {
    //         parseString(xml, function (err, result) {
    //             console.log(JSON.stringify(result));
    //         });
    //     });
    // }
    // https.request(options, callback).end();
    // return [];
}
fetchArticles(articles_1.externalArticles);
//fetchArticlesPerDb("pubmed", ["20021716"]);
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
