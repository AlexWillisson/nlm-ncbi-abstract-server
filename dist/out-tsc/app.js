"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var articles_1 = require("./articles");
var app = express_1.default();
var port = 3000;
app.get('/', function (req, res) {
    res.send(JSON.stringify(articles_1.articles));
});
app.listen(port, function () {
    console.info("Ready on port " + port);
});
