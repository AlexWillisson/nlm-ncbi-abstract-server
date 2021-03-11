import express from 'express';

import { articles } from './articles';

const app = express();
const port = 3000;
app.get('/', (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.send(JSON.stringify(articles));
});
app.listen(port, () => {
    console.info(`Ready on port ${port}`);
});
