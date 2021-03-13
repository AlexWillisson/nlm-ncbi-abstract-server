import express from 'express';
import fetch from 'node-fetch';
import { Parser as xmlParser } from 'xml2js';
import { Pool } from 'pg';
import pgFormat = require('pg-format');

import { ExternalArticle, ArticleData, AbstractSection, ArticleType } from './articles';

const pool = new Pool({
    user: 'node',
    host: 'localhost',
    database: 'abstract_viewer',
    password: 'tt#rXJn8&K#Q',
    port: 5432,
})

// TODO: generates uncached entries for cache misses
function fetchArticles(ids: number[]): Promise<ArticleData[][]> {
    return new Promise<ArticleData[][]>((resolve: any) => {
        externalArticleIdsFromDb(ids).then((externalArticles: ExternalArticle[]) => {
            let cacheHits: ExternalArticle[] = [];
            let cacheMisses: ExternalArticle[] = [];

            externalArticles.forEach((externalArticle: ExternalArticle) => {
                if (externalArticle.cached_id !== null && externalArticle.cached_id !== 0) {
                    cacheHits.push(externalArticle);
                } else {
                    cacheMisses.push(externalArticle);
                }
            });

            // TODO fetch cache hits
            let cachedArticles: Promise<ArticleData[]> = new Promise<ArticleData[]>((resolve: any) => {
                let articles: ArticleData[] = [];
                resolve(articles);
            });

            let articles = remoteFetchArticles(cacheMisses);
            articles.unshift(cachedArticles);

            resolve(Promise.all(articles));
        });
    });
}

function remoteFetchArticles(ids: ExternalArticle[]): Promise<ArticleData[]>[] {
    let splitByType: { [type: string]: ExternalArticle[] } = {};
    let types: string[] = [];

    ids.forEach((article: ExternalArticle) => {
        if (article.type in splitByType === false) {
            types.push(article.type);
            splitByType[article.type] = [];
        }

        splitByType[article.type].push(article);
    });

    let articlePromises: Promise<ArticleData[]>[] = [];
    types.forEach((type: string) => {
        let articles = fetchArticlesPerDb(type, splitByType[type]);
        articlePromises.push(articles);
    });

    return articlePromises;
}

function cacheArticles(externalArticles: ExternalArticle[], articles: ArticleData[]): void {
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
        let columns = ['article_id', 'title', 'abstract', "cache_date"];
        let queryStr = 'insert into cached_articles (' + columns.join(',') + ') values ($1, $2, $3, now()) returning id';
        let values = [article.id, article.title, JSON.stringify(article.abstract)];

        pool.query(queryStr, values, (error, results) => {
            if (error) {
                throw error
            }

            let externalArticle = externalArticleLookupTable[idHash(article.id, article.articleType)];

            let queryStr = 'update external_articles set cached_id=$1 where id=$2';
            let values = [results.rows[0].id, externalArticle.id];
            pool.query(queryStr, values, (error, results) => {
                if (error) {
                    throw error
                }
            });
        });
    });
}

function fetchArticlesPerDb(db: string, externalArticles: ExternalArticle[]): Promise<ArticleData[]> {
    let ids = externalArticles.map((article: ExternalArticle) => article.publicId);

    let params = {
        db: db,
        format: 'xml',
        id: ids.join(',')
    }

    let query = new URLSearchParams(params);
    return new Promise<ArticleData[]>((resolve: any) => {
        fetch('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?' + query.toString())
            .then((res: any) => res.text())
            .then((body: string) => {
                let parser = new xmlParser();
                parser.parseStringPromise(body)
                    .then((res: any) => {
                        let articleData: ArticleData[] = abstractsFromArticles(db, res);
                        cacheArticles(externalArticles, articleData);
                        resolve(articleData);
                    });
            });
    });
}

function abstractsFromArticles(db: string, rawArticle: any): ArticleData[] {
    if (db === 'pubmed') {
        return abstractsFromPubmedArticles(rawArticle, 'pubmed');
    } else {
        let article: ArticleData = {
            id: 'UnsupportedArticleDatabase',
            title: '',
            articleType: ''
        }

        return [article];
    }
}

function abstractsFromPubmedArticles(response: any, db: ArticleType): ArticleData[] {
    let rawArticles: any[] = response.PubmedArticleSet.PubmedArticle;
    let articles: ArticleData[] = [];

    rawArticles.forEach((rawArticle: any) => {
        let id: string, title: string, abstractSections: AbstractSection[];
        let rawAbstractSections: any[];
        id = rawArticle.MedlineCitation[0].PMID[0]['_'];
        title = rawArticle.MedlineCitation[0].Article[0].ArticleTitle;

        let article: ArticleData = {
            id: id,
            title: title,
            articleType: db
        };

        if (typeof rawArticle.MedlineCitation[0].Article[0].Abstract !== 'undefined') {
            rawAbstractSections = rawArticle.MedlineCitation[0].Article[0].Abstract[0].AbstractText;
            abstractSections = [];

            rawAbstractSections.forEach((rawSection: any) => {
                let section: AbstractSection;

                if (typeof rawSection === 'string') {
                    section = {
                        body: rawSection
                    }
                } else {
                    section = {
                        body: rawSection['_']
                    }

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

function externalArticleByIdFromDb(id: number): Promise<ExternalArticle> {
    return new Promise<ExternalArticle>((resolve: any) => {
        let columns = ['external_articles.article_id', 'types.name as type', 'external_articles.cached_id'];
        let join = 'join types on external_articles.type = types.id';

        let baseStr = 'select ' + columns.join(',') + ' from external_articles ' + join;
        let queryStr = pgFormat(baseStr + ' where external_articles.id = %L limit 1', id);

        pool.query(queryStr, (error, results) => {
            if (error) {
                throw error
            }

            let article: ExternalArticle = {
                publicId: results.rows[0].article_id,
                type: results.rows[0].type,
                cached_id: results.rows[0].cached_id,
                id: results.rows[0].id
            };

            resolve(article);
        });
    })
}

// Pass in [] for IDs to get all articles
function externalArticleIdsFromDb(ids: number[]): Promise<ExternalArticle[]> {
    return new Promise<ExternalArticle[]>((resolve: any) => {
        let columns = ['external_articles.id', 'external_articles.article_id', 'types.name as type', 'external_articles.cached_id'];
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
                    cached_id: row.cached_id,
                    id: row.id
                };
                articles.push(article);
            });

            resolve(articles);
        });
    })
}

var allArticleIds: number[] = [];
externalArticleIdsFromDb([]).then((resolve: ExternalArticle[]) => {
    allArticleIds = resolve.map((article: ExternalArticle) => article.id);
});

const app = express();
const port = 3000;
app.get('/', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

    fetchArticles(allArticleIds)
        .then((values: ArticleData[][]) => {
            let articles: ArticleData[] = values.flat(1);
            if (articles.length > 0) {
                res.send(JSON.stringify(articles));
            } else {
                res.send(JSON.stringify([]));
            }
        });
});
app.listen(port, () => {
    console.info(`Ready on port ${port}`);
});
