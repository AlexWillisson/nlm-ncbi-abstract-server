"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var node_fetch_1 = __importDefault(require("node-fetch"));
var xml2js_1 = require("xml2js");
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
    // let collectedArticles: ArticleData[] = [];
    types.forEach(function (type) {
        var articles = fetchArticlesPerDb(type, splitByType[type]);
        articles.then(function (res) {
            console.log(JSON.stringify(res));
        });
        // collectedArticles = collectedArticles.concat(articles);
    });
    return [];
    // return collectedArticles;
}
function fetchArticlesPerDb(db, ids) {
    var params = {
        db: db,
        format: 'xml',
        id: ids.join(',')
    };
    var query = new URLSearchParams(params);
    return new Promise(function (resolve) {
        node_fetch_1.default("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?" + query.toString())
            .then(function (res) { return res.text(); })
            .then(function (body) {
            var parser = new xml2js_1.Parser();
            parser.parseStringPromise(body)
                .then(function (res) {
                resolve(res);
            });
        });
    });
    // fetch("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?" + query.toString())
    //     .then((res: any) => res.text())
    //     .then((body: string) => {
    //         let parser = new xmlParser();
    //         parser.parseStringPromise(body)
    //             .then((res: any) => {
    //                 console.log(JSON.stringify(res));
    //             });
    //     });
    // return [];
    //         parseString(xml, function (err, result) {
    //             console.log(JSON.stringify(result));
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
