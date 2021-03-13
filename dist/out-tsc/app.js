"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const xml2js_1 = require("xml2js");
const pg_1 = require("pg");
const pgFormat = require("pg-format");
const pool = new pg_1.Pool({
    user: 'node',
    host: 'localhost',
    database: 'abstract_viewer',
    password: 'tt#rXJn8&K#Q',
    port: 5432,
});
// TODO: generates uncached entries for cache misses
function fetchArticles(ids) {
    return new Promise((resolve) => {
        externalArticleIdsFromDb(ids).then((externalArticles) => {
            let cacheHits = [];
            let cacheMisses = [];
            externalArticles.forEach((externalArticle) => {
                if (externalArticle.cached_id !== null && externalArticle.cached_id !== 0) {
                    cacheHits.push(externalArticle);
                }
                else {
                    cacheMisses.push(externalArticle);
                }
            });
            // TODO fetch cache hits
            let cachedArticles = new Promise((resolve) => {
                let articles = [];
                resolve(articles);
            });
            let articles = remoteFetchArticles(cacheMisses);
            articles.unshift(cachedArticles);
            resolve(Promise.all(articles));
        });
    });
}
//     // in allSettled, remoteFetchArticles will come next, then we'll collect the cache hits from the database
//     // TODO: fetch cache hits
//     let cachedArticles: Promise<ArticleData[]> = new Promise<ArticleData[]>((resolve: any) => {
//         let articles: ArticleData[] = [];
//         resolve(articles);
//     });
//     let articles = remoteFetchArticles(cacheMisses);
//     articles.unshift(cachedArticles);
//     return Promise.all(articles);
// }
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
        let articles = fetchArticlesPerDb(type, splitByType[type]);
        articlePromises.push(articles);
    });
    return articlePromises;
}
function cacheArticles(externalArticles, articles) {
    let externalArticleLookupTable = {};
    function idHash(id, type) {
        return type + ':' + id;
    }
    externalArticles.forEach((externalArticle) => {
        let hashedId = idHash(externalArticle.publicId, externalArticle.type);
        if (hashedId in externalArticleLookupTable) {
            throw new Error('somehow an article got in the DB twice');
        }
        externalArticleLookupTable[hashedId] = externalArticle;
    });
    articles.forEach((article) => {
        let columns = ['article_id', 'title', 'abstract', "cache_date"];
        let queryStr = 'insert into cached_articles (' + columns.join(',') + ') values ($1, $2, $3, now()) returning id';
        let values = [article.id, article.title, JSON.stringify(article.abstract)];
        pool.query(queryStr, values, (error, results) => {
            if (error) {
                throw error;
            }
            let externalArticle = externalArticleLookupTable[idHash(article.id, article.articleType)];
            let queryStr = 'update external_articles set cached_id=$1 where id=$2';
            let values = [results.rows[0].id, externalArticle.id];
            pool.query(queryStr, values, (error, results) => {
                if (error) {
                    throw error;
                }
            });
        });
    });
}
function fetchArticlesPerDb(db, externalArticles) {
    let ids = externalArticles.map((article) => article.publicId);
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
                let articleData = abstractsFromArticles(db, res);
                cacheArticles(externalArticles, articleData);
                resolve(articleData);
            });
        });
    });
}
function abstractsFromArticles(db, rawArticle) {
    if (db === 'pubmed') {
        return abstractsFromPubmedArticles(rawArticle, 'pubmed');
    }
    else {
        let article = {
            id: 'UnsupportedArticleDatabase',
            title: '',
            articleType: ''
        };
        return [article];
    }
}
function abstractsFromPubmedArticles(response, db) {
    let rawArticles = response.PubmedArticleSet.PubmedArticle;
    let articles = [];
    rawArticles.forEach((rawArticle) => {
        let id, title, abstractSections;
        let rawAbstractSections;
        id = rawArticle.MedlineCitation[0].PMID[0]['_'];
        title = rawArticle.MedlineCitation[0].Article[0].ArticleTitle;
        let article = {
            id: id,
            title: title,
            articleType: db
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
function externalArticleByIdFromDb(id) {
    return new Promise((resolve) => {
        let columns = ['external_articles.article_id', 'types.name as type', 'external_articles.cached_id'];
        let join = 'join types on external_articles.type = types.id';
        let baseStr = 'select ' + columns.join(',') + ' from external_articles ' + join;
        let queryStr = pgFormat(baseStr + ' where external_articles.id = %L limit 1', id);
        pool.query(queryStr, (error, results) => {
            if (error) {
                throw error;
            }
            let article = {
                publicId: results.rows[0].article_id,
                type: results.rows[0].type,
                cached_id: results.rows[0].cached_id,
                id: results.rows[0].id
            };
            resolve(article);
        });
    });
}
// Pass in [] for IDs to get all articles
function externalArticleIdsFromDb(ids) {
    return new Promise((resolve) => {
        let columns = ['external_articles.id', 'external_articles.article_id', 'types.name as type', 'external_articles.cached_id'];
        let join = 'join types on external_articles.type = types.id';
        let baseStr = 'select ' + columns.join(',') + ' from external_articles ' + join;
        let queryStr;
        if (ids.length > 0) {
            queryStr = pgFormat(baseStr + ' where external_articles.id in (%L)', ids);
        }
        else {
            queryStr = baseStr;
        }
        pool.query(queryStr, (error, results) => {
            if (error) {
                throw error;
            }
            let articles = [];
            results.rows.forEach((row) => {
                let article = {
                    publicId: row.article_id,
                    type: row.type,
                    cached_id: row.cached_id,
                    id: row.id
                };
                articles.push(article);
            });
            resolve(articles);
        });
    });
}
var allArticleIds = [];
externalArticleIdsFromDb([]).then((resolve) => {
    allArticleIds = resolve.map((article) => article.id);
});
const app = express_1.default();
const port = 3000;
app.get('/', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    fetchArticles(allArticleIds)
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
