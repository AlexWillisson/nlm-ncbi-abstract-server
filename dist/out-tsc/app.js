"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const https_1 = __importDefault(require("https"));
const fs_1 = __importDefault(require("fs"));
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
https_1.default.createServer({
    key: fs_1.default.readFileSync('/home/ec2-user/certs/abstracts.willisson.org/privkey.pem'),
    cert: fs_1.default.readFileSync('/home/ec2-user/certs/abstracts.willisson.org/cert.pem'),
    ca: fs_1.default.readFileSync('/home/ec2-user/certs/abstracts.willisson.org/chain.pem')
}, app)
    .listen(3000, function () {
    console.info(`Ready on port ${port}`);
});
