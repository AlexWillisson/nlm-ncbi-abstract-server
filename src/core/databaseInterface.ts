import pgFormat = require('pg-format');
import { Pool } from 'pg';

import { ExternalArticle, ArticleData } from '../articles';
import { remoteFetchArticles } from '../external-source-fetcher/externalSourceFetcher';
import { fetchArticlesFromCache } from '../article-cache/cache';

export const pool = new Pool({
    user: 'node',
    host: 'localhost',
    database: 'abstract_viewer',
    password: 'tt#rXJn8&K#Q',
    port: 5432,
})

export function fetchArticles(ids: number[]): Promise<ArticleData[][]> {
    return new Promise<ArticleData[][]>((resolve: any) => {
        externalArticleIdsFromBackend(ids).then((externalArticles: ExternalArticle[]) => {
            let cacheHits: ExternalArticle[] = [];
            let cacheMisses: ExternalArticle[] = [];

            externalArticles.forEach((externalArticle: ExternalArticle) => {
                if (externalArticle.cache_id !== null && externalArticle.cache_id !== 0) {
                    cacheHits.push(externalArticle);
                } else {
                    cacheMisses.push(externalArticle);
                }
            });

            resolve(fetchArticlesFromCache(cacheHits)
                .then((resolve: [ArticleData[], ExternalArticle[]]) => {
                    let articles: Promise<ArticleData[]>[] = [];

                    if (resolve[0].length > 0) {
                        let cachedArticles = resolve[0];
                        let cacheHitsPromise = new Promise<ArticleData[]>((resolve: any) => {
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

// Pass in [] for IDs to get all articles
export function externalArticleIdsFromBackend(ids: number[]): Promise<ExternalArticle[]> {
    return new Promise<ExternalArticle[]>((resolve: any) => {
        let columns = ['external_articles.id', 'external_articles.article_id', 'types.name as type', 'external_articles.cache_id'];
        let join = 'join types on external_articles.type = types.id';

        let baseStr = 'select ' + columns.join(',') + ' from external_articles ' + join;

        let queryStr;
        if (ids.length > 0) {
            queryStr = pgFormat(baseStr + ' where external_articles.id in (%L)', ids);
        } else {
            queryStr = baseStr;
        }

        pool.query(queryStr, (error, results) => {
            if (error) {
                throw error
            }

            let articles: ExternalArticle[] = [];
            results.rows.forEach((row: any) => {
                let article: ExternalArticle = {
                    publicId: row.article_id,
                    type: row.type,
                    cache_id: row.cache_id,
                    id: row.id
                };
                articles.push(article);
            });

            resolve(articles);
        });
    })
}
