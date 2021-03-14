import express from 'express';
import https from 'https';
import fs from 'fs';

import { ExternalArticle, ArticleData } from './articles';
import { fetchArticles, externalArticleIdsFromBackend } from './core/databaseInterface';

// This is just a fancy way to get the IDs for all the articles in the database
var allArticleIds: number[] = [];
externalArticleIdsFromBackend([]).then((resolve: ExternalArticle[]) => {
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

https.createServer({
    key: fs.readFileSync('/home/ec2-user/certs/abstracts.willisson.org/privkey.pem'),
    cert: fs.readFileSync('/home/ec2-user/certs/abstracts.willisson.org/cert.pem'),
    ca: fs.readFileSync('/home/ec2-user/certs/abstracts.willisson.org/chain.pem')
}, app)
.listen(3000, function() {
        console.info(`Ready on port ${port}`);
})
