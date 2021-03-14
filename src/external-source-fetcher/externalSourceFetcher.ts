import fetch from 'node-fetch';
import { Parser as xmlParser } from 'xml2js';

import { ExternalArticle, ArticleData } from '../articles';

import { dataFromPubmedArticles } from './pubmedProcessor';
import { cacheArticles } from '../article-cache/cache';

export function remoteFetchArticles(ids: ExternalArticle[]): Promise<ArticleData[]>[] {
    let splitByType: { [type: string]: ExternalArticle[] } = {};
    let types: string[] = [];

    ids.forEach((article: ExternalArticle) => {
        if (article.type in splitByType === false) {
            types.push(article.type);
            splitByType[article.type] = [];
        }

        splitByType[article.type].push(article);
    });

    let articlePromises: Promise<ArticleData[]>[] = [];
    types.forEach((type: string) => {
        let articles = fetchArticlesPerRemoteDb(type, splitByType[type]);
        articlePromises.push(articles);
    });

    return articlePromises;
}

function fetchArticlesPerRemoteDb(remoteDb: string, externalArticles: ExternalArticle[]): Promise<ArticleData[]> {
    let ids = externalArticles.map((article: ExternalArticle) => article.publicId);

    let params = {
        db: remoteDb,
        format: 'xml',
        id: ids.join(',')
    }

    let query = new URLSearchParams(params);
    return new Promise<ArticleData[]>((resolve: any) => {
        fetch('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?' + query.toString())
            .then((res: any) => res.text())
            .then((body: string) => {
                let parser = new xmlParser();
                parser.parseStringPromise(body)
                    .then((res: any) => {
                        let articleData: ArticleData[] = dataFromExternalArticleSource(remoteDb, res);
                        cacheArticles(externalArticles, articleData);
                        resolve(articleData);
                    });
            });
    });
}

function dataFromExternalArticleSource(remoteDb: string, rawArticle: any): ArticleData[] {
    if (remoteDb === 'pubmed') {
        return dataFromPubmedArticles(rawArticle, 'pubmed');
    } else {
        let article: ArticleData = {
            id: 'UnsupportedArticleDatabase',
            title: '',
            articleSource: '',
            date: new Date(0)
        }

        return [article];
    }
}
