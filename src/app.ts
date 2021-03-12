import express from 'express';
import http from 'http';
import fetch from 'node-fetch';
import { ExceptionHandler } from 'winston';

import { Parser as xmlParser } from 'xml2js';

import { ExternalArticle, ArticleData, externalArticles } from './articles';

function fetchArticles(ids: ExternalArticle[]): Promise<any> {
    let splitByType: { [type: string]: string[] } = {};
    let types: string[] = [];

    ids.forEach((article: ExternalArticle) => {
        if (article.type in splitByType === false) {
            types.push(article.type);
            splitByType[article.type] = [];
        }

        splitByType[article.type].push(article.id);
    });

    let articlePromiseList: Promise<any>[] = [];
    types.forEach((type: string) => {
        let articles = fetchArticlesPerDb(type, splitByType[type]);
        articlePromiseList.push(articles);
    });

    let articlePromises = Promise.allSettled(articlePromiseList);

    // return Promise.all(articlePromises);
    return articlePromises;
}

function fetchArticlesPerDb(db: string, ids: string[]): Promise<any> {
    let params = {
        db: db,
        format: 'xml',
        id: ids.join(',')
    }

    let query = new URLSearchParams(params);
    return new Promise<any>((resolve: any) => {
        fetch("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?" + query.toString())
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
    if (db === "pubmed") {
        return abstractsFromPubmedArticles(rawArticle);
    } else {
        let article: ArticleData = {
            id: "UnsupportedArticleDatabase",
            title: '',
            abstract: ''
        }

        return [article];
    }
}

function abstractsFromPubmedArticles(response: any): ArticleData[] {
    let rawArticles: any[] = response.PubmedArticleSet.PubmedArticle;
    let articles: ArticleData[] = [];

    rawArticles.forEach((rawArticle: any) => {
        let id: string, title: string, abstract: string;
        id = rawArticle.MedlineCitation[0].PMID[0]['_'];
        title = rawArticle.MedlineCitation[0].Article[0].ArticleTitle;
    
        try {
            abstract = rawArticle.MedlineCitation[0].Article[0].Abstract[0].AbstractText;
        } catch (error) {
            abstract = 'No abstract available';
        }

        let article: ArticleData = {
            id: id,
            title: title,
            abstract: abstract
        }

        articles.push(article);
    });

    console.log(articles);

    return articles;
}

const app = express();
const port = 3000;
app.get('/', (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

    fetchArticles(externalArticles)
        .then((values: any) => {
            res.send(JSON.stringify(values));
        });
});
app.listen(port, () => {
    console.info(`Ready on port ${port}`);
});
