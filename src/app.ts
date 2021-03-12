import express from 'express';
import fetch from 'node-fetch';
import { Parser as xmlParser } from 'xml2js';
import { Pool } from 'pg';
import { Observable } from 'rxjs';

import { ExternalArticle, ArticleData, AbstractSection } from './articles';

const pool = new Pool({
    user: 'node',
    host: 'localhost',
    database: 'abstract_viewer',
    password: 'tt#rXJn8&K#Q',
    port: 5432,
})

function fetchArticles(ids: ExternalArticle[]): Promise<ArticleData[][]> {
    let cacheHits: ExternalArticle[] = [];
    let cacheMisses: ExternalArticle[] = [];

    ids.forEach((externalArticle: ExternalArticle) => {
        if (externalArticle.cached_id !== null && externalArticle.cached_id !== 0) {
            cacheHits.push(externalArticle);
        } else {
            cacheMisses.push(externalArticle);
        }
    });
    
    // fetch cache hits
    let cachedArticles: Promise<ArticleData[]> = new Promise<ArticleData[]>((resolve: any) => {
        let articles: ArticleData[] = [];
        resolve(articles);
    });

    let articles = remoteFetchArticles(cacheMisses);
    articles.unshift(cachedArticles);

    return Promise.all(articles);
}

function remoteFetchArticles(ids: ExternalArticle[]): Promise<ArticleData[]>[] {
    let splitByType: { [type: string]: string[] } = {};
    let types: string[] = [];

    ids.forEach((article: ExternalArticle) => {
        if (article.type in splitByType === false) {
            types.push(article.type);
            splitByType[article.type] = [];
        }

        splitByType[article.type].push(article.id);
    });

    let articlePromises: Promise<ArticleData[]>[] = [];
    types.forEach((type: string) => {
        let articles = fetchArticlesPerDb(type, splitByType[type]);
        articlePromises.push(articles);
    });

    return articlePromises;
    // return Promise.all(articlePromises);
}

function fetchArticlesPerDb(db: string, ids: string[]): Promise<ArticleData[]> {
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
                        resolve(abstractsFromArticles(db, res));
                    });
            });
    });
}

function abstractsFromArticles(db: string, rawArticle: any): ArticleData[] {
    if (db === 'pubmed') {
        return abstractsFromPubmedArticles(rawArticle);
    } else {
        let article: ArticleData = {
            id: 'UnsupportedArticleDatabase',
            title: ''
        }

        return [article];
    }
}

function abstractsFromPubmedArticles(response: any): ArticleData[] {
    let rawArticles: any[] = response.PubmedArticleSet.PubmedArticle;
    let articles: ArticleData[] = [];

    rawArticles.forEach((rawArticle: any) => {
        let id: string, title: string, abstractSections: AbstractSection[];
        let rawAbstractSections: any[];
        id = rawArticle.MedlineCitation[0].PMID[0]['_'];
        title = rawArticle.MedlineCitation[0].Article[0].ArticleTitle;

        let article: ArticleData = {
            id: id,
            title: title
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

var externalArticles: ExternalArticle[] = [];

const articleIdFetchQueue = new Promise((resolve: any) => {
    let columns = ['external_articles.article_id as id', 'types.name as type', 'external_articles.cached_id'];
    let join = 'join types on external_articles.type = types.id';
    let queryStr = 'select ' + columns.join(',') + ' from external_articles ' + join;

    pool.query(queryStr, (error, results) => {
        if (error) {
            throw error
        }

        results.rows.forEach((row: ExternalArticle) => {
            externalArticles.push(row);
        });
    });
})

const app = express();
const port = 3000;
app.get('/', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

    fetchArticles(externalArticles)
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
