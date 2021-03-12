import express from 'express';
import https from 'https';
import http from 'http';

import { parseString } from 'xml2js';

import { testArticles } from './testArticles';
import { ExternalArticle, ArticleData, externalArticles } from './articles';

function fetchArticles(ids: number[]): ArticleData[] {
    let params = {
        db: 'pubmed',
        format: 'xml',
        id: ids.join(',')
    }

    let query = new URLSearchParams(params);
    let path = '/entrez/eutils/efetch.fcgi?' + query.toString();
    
    let options = {
        host: 'eutils.ncbi.nlm.nih.gov',
        path: path
    };

    let callback = function (response: http.IncomingMessage) {
        var xml = '';
        var fetchResults = '';

        response.on('data', function (chunk) {
            xml += chunk;
        });

        response.on('end', function () {
            parseString(xml, function (err, result) {
                console.log(JSON.stringify(result));
            });
        });
    }

    https.request(options, callback).end();

    return [];
}
fetchArticles([20021716]);

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
