import pgFormat = require('pg-format');

import { ExternalArticle, ArticleData, AbstractSection, ArticleType } from '../articles';

import { pool } from '../core/databaseInterface';

export function cacheArticles(externalArticles: ExternalArticle[], articles: ArticleData[]): void {
    let externalArticleLookupTable: { [id: string]: ExternalArticle } = {};

    function idHash(id: string, type: string) {
        return type + ':' + id;
    }

    externalArticles.forEach((externalArticle: ExternalArticle) => {
        let hashedId = idHash(externalArticle.publicId, externalArticle.type);
        if (hashedId in externalArticleLookupTable) {
            throw new Error('somehow an article got in the DB twice');
        }

        externalArticleLookupTable[hashedId] = externalArticle;
    });

    articles.forEach((article: ArticleData) => {
        let columns = ['article_id', 'title', 'abstract', 'source', 'revision_date', 'cache_date'];
        let queryStr = 'insert into article_cache (' + columns.join(',') + ') values ($1, $2, $3, $4, $5, now()) returning id';
        let values = [article.id, article.title, JSON.stringify(article.abstract), article.articleSource, article.date];

        pool.query(queryStr, values, (error, results) => {
            if (error) {
                throw error
            }

            let externalArticle = externalArticleLookupTable[idHash(article.id, article.articleSource)];

            let queryStr = 'update external_articles set cache_id=$1 where id=$2';
            let values = [results.rows[0].id, externalArticle.id];
            pool.query(queryStr, values, (error, results) => {
                if (error) {
                    throw error
                }
            });
        });
    });
}

export function fetchArticlesFromCache(articles: ExternalArticle[]): Promise<[ArticleData[], ExternalArticle[]]> {
    if (articles.length === 0) {
        return new Promise<[ArticleData[], ExternalArticle[]]>((resolve: any) => {
            resolve([[], []]);
        });
    }

    return new Promise<[ArticleData[], ExternalArticle[]]>((resolve: any) => {
        let columns = ['id', 'article_id', 'title', 'abstract', 'source', 'revision_date'];
        let externalIds = new Set(articles.map((article: ExternalArticle) => article.cache_id));

        let baseStr = 'select ' + columns.join(',') + ' from article_cache where id in (%s)';
        let queryStr = pgFormat(baseStr, Array.from(externalIds));

        pool.query(queryStr, (error, results) => {
            if (error) {
                resolve([[], articles]);
            }

            let foundIds = new Set();
            let cachedArticles: ArticleData[] = [];
            results.rows.forEach((row: any) => {
                foundIds.add(row.id);

                let article: ArticleData = {
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

            let cacheCorruptions: ExternalArticle[] = articles.filter(x => cacheCorruptionsIds.has(x.cache_id));

            resolve([cachedArticles, cacheCorruptions]);
        });
    });
}