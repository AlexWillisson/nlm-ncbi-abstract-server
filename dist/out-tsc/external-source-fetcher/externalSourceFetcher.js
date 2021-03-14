"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.remoteFetchArticles = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const xml2js_1 = require("xml2js");
const pubmedProcessor_1 = require("./pubmedProcessor");
const cache_1 = require("../article-cache/cache");
function remoteFetchArticles(ids) {
    let splitByType = {};
    let types = [];
    ids.forEach((article) => {
        if (article.type in splitByType === false) {
            types.push(article.type);
            splitByType[article.type] = [];
        }
        splitByType[article.type].push(article);
    });
    let articlePromises = [];
    types.forEach((type) => {
        let articles = fetchArticlesPerRemoteDb(type, splitByType[type]);
        articlePromises.push(articles);
    });
    return articlePromises;
}
exports.remoteFetchArticles = remoteFetchArticles;
function fetchArticlesPerRemoteDb(remoteDb, externalArticles) {
    let ids = externalArticles.map((article) => article.publicId);
    let params = {
        db: remoteDb,
        format: 'xml',
        id: ids.join(',')
    };
    let query = new URLSearchParams(params);
    return new Promise((resolve) => {
        node_fetch_1.default('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?' + query.toString())
            .then((res) => res.text())
            .then((body) => {
            let parser = new xml2js_1.Parser();
            parser.parseStringPromise(body)
                .then((res) => {
                let articleData = dataFromExternalArticleSource(remoteDb, res);
                cache_1.cacheArticles(externalArticles, articleData);
                resolve(articleData);
            });
        });
    });
}
function dataFromExternalArticleSource(remoteDb, rawArticle) {
    if (remoteDb === 'pubmed') {
        return pubmedProcessor_1.dataFromPubmedArticles(rawArticle, 'pubmed');
    }
    else {
        let article = {
            id: 'UnsupportedArticleDatabase',
            title: '',
            articleSource: '',
            date: new Date(0)
        };
        return [article];
    }
}
