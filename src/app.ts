import express from 'express';
import pgFormat = require('pg-format');

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
app.listen(port, () => {
    console.info(`Ready on port ${port}`);
});
