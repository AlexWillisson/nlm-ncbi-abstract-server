import express from 'express';
// import https from 'https';
import http from 'http';
import fetch from 'node-fetch';

import { parseString } from 'xml2js';

import { testArticles } from './testArticles';
import { ExternalArticle, ArticleData, externalArticles } from './articles';

function fetchArticles(ids: ExternalArticle[]): ArticleData[] {
    let splitByType: { [type: string]: string[] } = {};
    let types: string[] = [];

    ids.forEach((article: ExternalArticle) => {
        if (article.type in splitByType === false) {
            types.push(article.type);
            splitByType[article.type] = [];
        }

        splitByType[article.type].push(article.id);
    });

    let collectedArticles: ArticleData[] = [];
    types.forEach((type: string) => {
        let articles = fetchArticlesPerDb(type, splitByType[type]);
        collectedArticles = collectedArticles.concat(articles);
    });

    return collectedArticles;
}

function fetchArticlesPerDb(db: string, ids: string[]): ArticleData[] {
    let params = {
        db: db,
        format: 'xml',
        id: ids.join(',')
    }

    let query = new URLSearchParams(params);

    fetch("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?" + query.toString())
        .then((res: any) => res.text())
        .then((body: string) => {
            console.log(body)
        });

    return [];

    //         parseString(xml, function (err, result) {
    //             console.log(JSON.stringify(result));
}

fetchArticles(externalArticles);

//fetchArticlesPerDb("pubmed", ["20021716"]);

const app = express();
const port = 3000;
app.get('/', (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

    res.send(JSON.stringify(testArticles));
});
app.listen(port, () => {
    console.info(`Ready on port ${port}`);
});
