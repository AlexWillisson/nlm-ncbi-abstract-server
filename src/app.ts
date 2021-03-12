import express from 'express';
// import https from 'https';
import http from 'http';
import fetch from 'node-fetch';

import { Parser as xmlParser } from 'xml2js';

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

    // let collectedArticles: ArticleData[] = [];
    types.forEach((type: string) => {
        let articles = fetchArticlesPerDb(type, splitByType[type]);
        articles.then((res: any) => {
            console.log(JSON.stringify(res));
        });
        // collectedArticles = collectedArticles.concat(articles);
    });

    return [];
    // return collectedArticles;
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
                    resolve(res);
                });
        });
    });
    // fetch("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?" + query.toString())
    //     .then((res: any) => res.text())
    //     .then((body: string) => {
    //         let parser = new xmlParser();
    //         parser.parseStringPromise(body)
    //             .then((res: any) => {
    //                 console.log(JSON.stringify(res));
    //             });
    //     });

    // return [];

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
