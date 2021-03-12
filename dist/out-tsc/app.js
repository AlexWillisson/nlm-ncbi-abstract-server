"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const xml2js_1 = require("xml2js");
const articles_1 = require("./articles");
function fetchArticles(ids) {
    let splitByType = {};
    let types = [];
    ids.forEach((article) => {
        if (article.type in splitByType === false) {
            types.push(article.type);
            splitByType[article.type] = [];
        }
        splitByType[article.type].push(article.id);
    });
    // let collectedArticles: ArticleData[] = [];
    let articlePromiseList = [];
    types.forEach((type) => {
        let articles = fetchArticlesPerDb(type, splitByType[type]);
        articlePromiseList.push(articles);
        // articles.then((res: any) => {
        //     console.log(JSON.stringify(res));
        // });
        // collectedArticles = collectedArticles.concat(articles);
    });
    let articlePromises = Promise.allSettled(articlePromiseList);
    // return Promise.all(articlePromises);
    return articlePromises;
}
function fetchArticlesPerDb(db, ids) {
    let params = {
        db: db,
        format: 'xml',
        id: ids.join(',')
    };
    let query = new URLSearchParams(params);
    return new Promise((resolve) => {
        node_fetch_1.default("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?" + query.toString())
            .then((res) => res.text())
            .then((body) => {
            let parser = new xml2js_1.Parser();
            parser.parseStringPromise(body)
                .then((res) => {
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
const app = express_1.default();
const port = 3000;
app.get('/', (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    fetchArticles(articles_1.externalArticles)
        .then((values) => {
        res.send(JSON.stringify(values));
        // allArticles = values;
    });
    // res.send(JSON.stringify(testArticles));
});
app.listen(port, () => {
    console.info(`Ready on port ${port}`);
});
//fetchArticlesPerDb("pubmed", ["20021716"]);
