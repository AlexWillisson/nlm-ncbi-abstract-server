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
function fetchArticles(ids) {
    return new Promise((resolve) => {
        externalArticleIdsFromBackend(ids).then((externalArticles) => {
            let cacheHits = [];
            let cacheMisses = [];
            externalArticles.forEach((externalArticle) => {
                if (externalArticle.cache_id !== null && externalArticle.cache_id !== 0) {
                    cacheHits.push(externalArticle);
                }
                else {
                    cacheMisses.push(externalArticle);
                }
            });
            resolve(fetchArticlesFromCache(cacheHits)
                .then((resolve) => {
                let articles = [];
                if (resolve[0].length > 0) {
                    let cachedArticles = resolve[0];
                    let cacheHitsPromise = new Promise((resolve) => {
                        resolve(cachedArticles);
                    });
                    articles = articles.concat([cacheHitsPromise]);
                }
                cacheMisses = cacheMisses.concat(resolve[1]);
                articles = articles.concat(remoteFetchArticles(cacheMisses));
                return Promise.all(articles);
            }));
        });
    });
}
function fetchArticlesFromCache(articles) {
    if (articles.length === 0) {
        return new Promise((resolve) => {
            resolve([[], []]);
        });
    }
    return new Promise((resolve) => {
        let columns = ['id', 'article_id', 'title', 'abstract', 'source', 'revision_date'];
        let externalIds = new Set(articles.map((article) => article.cache_id));
        let baseStr = 'select ' + columns.join(',') + ' from article_cache where id in (%s)';
        let queryStr = pgFormat(baseStr, Array.from(externalIds));
        pool.query(queryStr, (error, results) => {
            if (error) {
                resolve([[], articles]);
            }
            let foundIds = new Set();
            let cachedArticles = [];
            results.rows.forEach((row) => {
                foundIds.add(row.id);
                let article = {
                    id: row.article_id,
                    title: row.title,
                    articleSource: row.articleSource,
                    date: row.revision_date
                };
                if (row.abstract !== null) {
                    article.abstract = row.abstract;
                }
                cachedArticles.push(article);
            });
            let cacheCorruptionsIds = new Set([...externalIds].filter(x => !foundIds.has(x)));
            let cacheCorruptions = articles.filter(x => cacheCorruptionsIds.has(x.cache_id));
            resolve([cachedArticles, cacheCorruptions]);
        });
    });
}
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
        let columns = ['article_id', 'title', 'abstract', 'source', 'revision_date', 'cache_date'];
        let queryStr = 'insert into article_cache (' + columns.join(',') + ') values ($1, $2, $3, $4, $5, now()) returning id';
        let values = [article.id, article.title, JSON.stringify(article.abstract), article.articleSource, article.date];
        pool.query(queryStr, values, (error, results) => {
            if (error) {
                throw error;
            }
            let externalArticle = externalArticleLookupTable[idHash(article.id, article.articleSource)];
            let queryStr = 'update external_articles set cache_id=$1 where id=$2';
            let values = [results.rows[0].id, externalArticle.id];
            pool.query(queryStr, values, (error, results) => {
                if (error) {
                    throw error;
                }
            });
        });
    });
}
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
                cacheArticles(externalArticles, articleData);
                resolve(articleData);
            });
        });
    });
}
function dataFromExternalArticleSource(remoteDb, rawArticle) {
    if (remoteDb === 'pubmed') {
        return dataFromPubmedArticles(rawArticle, 'pubmed');
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
function parseEutilsDate(eutilsDate) {
    if (eutilsDate === undefined) {
        return new Date(0);
    }
    try {
        let year = parseInt(eutilsDate[0].Year);
        let month = parseInt(eutilsDate[0].Month);
        let day = parseInt(eutilsDate[0].Day);
        return new Date(year, month - 1, day);
    }
    catch {
        return new Date(0);
    }
}
function dataFromPubmedArticles(response, remoteDb) {
    let rawArticles = response.PubmedArticleSet.PubmedArticle;
    let articles = [];
    rawArticles.forEach((rawArticle) => {
        let id, title, abstractSections;
        let rawAbstractSections;
        id = rawArticle.MedlineCitation[0].PMID[0]['_'];
        title = rawArticle.MedlineCitation[0].Article[0].ArticleTitle[0];
        let articleDate;
        let completeDate = parseEutilsDate(rawArticle.MedlineCitation[0].DateCompleted);
        let revisedDate = parseEutilsDate(rawArticle.MedlineCitation[0].DateRevised);
        if (revisedDate > completeDate) {
            articleDate = revisedDate;
        }
        else {
            articleDate = completeDate;
        }
        let article = {
            id: id,
            title: title,
            articleSource: remoteDb,
            date: articleDate
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
// Pass in [] for IDs to get all articles
function externalArticleIdsFromBackend(ids) {
    return new Promise((resolve) => {
        let columns = ['external_articles.id', 'external_articles.article_id', 'types.name as type', 'external_articles.cache_id'];
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
                    cache_id: row.cache_id,
                    id: row.id
                };
                articles.push(article);
            });
            resolve(articles);
        });
    });
}
var allArticleIds = [];
externalArticleIdsFromBackend([]).then((resolve) => {
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
