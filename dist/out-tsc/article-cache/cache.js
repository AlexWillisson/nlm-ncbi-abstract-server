"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchArticlesFromCache = exports.cacheArticles = void 0;
const pgFormat = require("pg-format");
const databaseInterface_1 = require("../core/databaseInterface");
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
        databaseInterface_1.pool.query(queryStr, values, (error, results) => {
            if (error) {
                throw error;
            }
            let externalArticle = externalArticleLookupTable[idHash(article.id, article.articleSource)];
            let queryStr = 'update external_articles set cache_id=$1 where id=$2';
            let values = [results.rows[0].id, externalArticle.id];
            databaseInterface_1.pool.query(queryStr, values, (error, results) => {
                if (error) {
                    throw error;
                }
            });
        });
    });
}
exports.cacheArticles = cacheArticles;
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
        databaseInterface_1.pool.query(queryStr, (error, results) => {
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
exports.fetchArticlesFromCache = fetchArticlesFromCache;
