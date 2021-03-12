"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const xml2js_1 = require("xml2js");
const pg_1 = require("pg");
const pool = new pg_1.Pool({
    user: 'node',
    host: 'localhost',
    database: 'abstract_viewer',
    password: 'tt#rXJn8&K#Q',
    port: 5432,
});
function fetchArticles(ids) {
    let cacheHits = [];
    let cacheMisses = [];
    ids.forEach((externalArticle) => {
        if (externalArticle.cached_id !== null && externalArticle.cached_id !== 0) {
            cacheHits.push(externalArticle);
        }
        else {
            cacheMisses.push(externalArticle);
        }
    });
    // fetch cache hits
    let cachedArticles = new Promise((resolve) => {
        let articles = [];
        resolve(articles);
    });
    let articles = remoteFetchArticles(cacheMisses);
    articles.unshift(cachedArticles);
    return Promise.all(articles);
}
function remoteFetchArticles(ids) {
    let splitByType = {};
    let types = [];
    ids.forEach((article) => {
        if (article.type in splitByType === false) {
            types.push(article.type);
            splitByType[article.type] = [];
        }
        splitByType[article.type].push(article.id);
    });
    let articlePromises = [];
    types.forEach((type) => {
        let articles = fetchArticlesPerDb(type, splitByType[type]);
        articlePromises.push(articles);
    });
    return articlePromises;
    // return Promise.all(articlePromises);
}
function fetchArticlesPerDb(db, ids) {
    let params = {
        db: db,
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
                resolve(abstractsFromArticles(db, res));
            });
        });
    });
}
function abstractsFromArticles(db, rawArticle) {
    if (db === 'pubmed') {
        return abstractsFromPubmedArticles(rawArticle);
    }
    else {
        let article = {
            id: 'UnsupportedArticleDatabase',
            title: ''
        };
        return [article];
    }
}
function abstractsFromPubmedArticles(response) {
    let rawArticles = response.PubmedArticleSet.PubmedArticle;
    let articles = [];
    rawArticles.forEach((rawArticle) => {
        let id, title, abstractSections;
        let rawAbstractSections;
        id = rawArticle.MedlineCitation[0].PMID[0]['_'];
        title = rawArticle.MedlineCitation[0].Article[0].ArticleTitle;
        let article = {
            id: id,
            title: title
        };
        if (typeof rawArticle.MedlineCitation[0].Article[0].Abstract !== 'undefined') {
            rawAbstractSections = rawArticle.MedlineCitation[0].Article[0].Abstract[0].AbstractText;
            abstractSections = [];
            rawAbstractSections.forEach((rawSection) => {
                let section;
                if (typeof rawSection === 'string') {
                    section = {
                        body: rawSection
                    };
                }
                else {
                    section = {
                        body: rawSection['_']
                    };
                    if (rawSection['$'] && rawSection['$'].Label) {
                        section.label = rawSection['$'].Label.toLowerCase();
                    }
                }
                abstractSections.push(section);
            });
            article.abstract = abstractSections;
        }
        articles.push(article);
    });
    return articles;
}
var externalArticles = [];
const articleIdFetchQueue = new Promise((resolve) => {
    let columns = ['external_articles.article_id as id', 'types.name as type', 'external_articles.cached_id'];
    let join = 'join types on external_articles.type = types.id';
    let queryStr = 'select ' + columns.join(',') + ' from external_articles ' + join;
    pool.query(queryStr, (error, results) => {
        if (error) {
            throw error;
        }
        results.rows.forEach((row) => {
            externalArticles.push(row);
        });
    });
});
const app = express_1.default();
const port = 3000;
app.get('/', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    fetchArticles(externalArticles)
        .then((values) => {
        let articles = values.flat(1);
        if (articles.length > 0) {
            res.send(JSON.stringify(articles));
        }
        else {
            res.send(JSON.stringify([]));
        }
    });
});
app.listen(port, () => {
    console.info(`Ready on port ${port}`);
});
