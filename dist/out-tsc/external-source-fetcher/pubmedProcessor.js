"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataFromPubmedArticles = void 0;
function dataFromPubmedArticles(response, remoteDb) {
    let rawArticles = response.PubmedArticleSet.PubmedArticle;
    let articles = [];
    rawArticles.forEach((rawArticle) => {
        let id, title, abstractSections;
        let rawAbstractSections;
        id = rawArticle.MedlineCitation[0].PMID[0]['_'];
        title = rawArticle.MedlineCitation[0].Article[0].ArticleTitle[0];
        let articleDate;
        let completeDate = parseEutilsDate(rawArticle.MedlineCitation[0].DateCompleted);
        let revisedDate = parseEutilsDate(rawArticle.MedlineCitation[0].DateRevised);
        if (revisedDate > completeDate) {
            articleDate = revisedDate;
        }
        else {
            articleDate = completeDate;
        }
        let article = {
            id: id,
            title: title,
            articleSource: remoteDb,
            date: articleDate
        };
        if (typeof rawArticle.MedlineCitation[0].Article[0].Abstract !== 'undefined') {
            rawAbstractSections = rawArticle.MedlineCitation[0].Article[0].Abstract[0].AbstractText;
            abstractSections = [];
            rawAbstractSections.forEach((rawSection) => {
                let section;
                if (typeof rawSection === 'string') {
                    section = {
                        body: rawSection
                    };
                }
                else {
                    section = {
                        body: rawSection['_']
                    };
                    if (rawSection['$'] && rawSection['$'].Label) {
                        section.label = rawSection['$'].Label.toLowerCase();
                    }
                }
                abstractSections.push(section);
            });
            article.abstract = abstractSections;
        }
        articles.push(article);
    });
    return articles;
}
exports.dataFromPubmedArticles = dataFromPubmedArticles;
function parseEutilsDate(eutilsDate) {
    if (eutilsDate === undefined) {
        return new Date(0);
    }
    try {
        let year = parseInt(eutilsDate[0].Year);
        let month = parseInt(eutilsDate[0].Month);
        let day = parseInt(eutilsDate[0].Day);
        return new Date(year, month - 1, day);
    }
    catch {
        return new Date(0);
    }
}
