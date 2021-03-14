"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.externalArticleIdsFromBackend = exports.fetchArticles = exports.pool = void 0;
const pgFormat = require("pg-format");
const pg_1 = require("pg");
const externalSourceFetcher_1 = require("../external-source-fetcher/externalSourceFetcher");
const cache_1 = require("../article-cache/cache");
exports.pool = new pg_1.Pool({
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
            resolve(cache_1.fetchArticlesFromCache(cacheHits)
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
                articles = articles.concat(externalSourceFetcher_1.remoteFetchArticles(cacheMisses));
                return Promise.all(articles);
            }));
        });
    });
}
exports.fetchArticles = fetchArticles;
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
        exports.pool.query(queryStr, (error, results) => {
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
exports.externalArticleIdsFromBackend = externalArticleIdsFromBackend;
