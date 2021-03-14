"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const databaseInterface_1 = require("./core/databaseInterface");
// This is just a fancy way to get the IDs for all the articles in the database
var allArticleIds = [];
databaseInterface_1.externalArticleIdsFromBackend([]).then((resolve) => {
    allArticleIds = resolve.map((article) => article.id);
});
const app = express_1.default();
const port = 3000;
app.get('/', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    databaseInterface_1.fetchArticles(allArticleIds)
        .then((values) => {
        let articles = values.flat(1);
        if (articles.length > 0) {
            res.send(JSON.stringify(articles));
        }
        else {
            res.send(JSON.stringify([]));
        }
    });
});
app.listen(port, () => {
    console.info(`Ready on port ${port}`);
});
