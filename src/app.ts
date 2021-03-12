import express from 'express';
import https from 'https';
import http from 'http';

import { testArticles } from './testArticles';
import { ExternalArticle, ArticleData, externalArticles } from './articles';

function fetchArticle(id: number): ArticleData[] {
    var options = {
        host: 'eutils.ncbi.nlm.nih.gov',
        path: '/entrez/eutils/efetch.fcgi?db=pubmed&id=20021716&format=xml'
    };

    let callback = function (response: http.IncomingMessage) {
        var str = '';

        response.on('data', function (chunk) {
            str += chunk;
        });

        response.on('end', function () {
            console.log(str);
        });
    }

    https.request(options, callback).end();

    return [];
}
fetchArticle(20021716);

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
