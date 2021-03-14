import { ArticleData, AbstractSection, ArticleType } from '../articles';

export function dataFromPubmedArticles(response: any, remoteDb: ArticleType): ArticleData[] {
    let rawArticles: any[] = response.PubmedArticleSet.PubmedArticle;
    let articles: ArticleData[] = [];

    rawArticles.forEach((rawArticle: any) => {
        let id: string, title: string, abstractSections: AbstractSection[];
        let rawAbstractSections: any[];
        id = rawArticle.MedlineCitation[0].PMID[0]['_'];
        title = rawArticle.MedlineCitation[0].Article[0].ArticleTitle[0];

        let articleDate;
        let completeDate = parseEutilsDate(rawArticle.MedlineCitation[0].DateCompleted);
        let revisedDate = parseEutilsDate(rawArticle.MedlineCitation[0].DateRevised);

        if (revisedDate > completeDate) {
            articleDate = revisedDate;
        } else {
            articleDate = completeDate;
        }

        let article: ArticleData = {
            id: id,
            title: title,
            articleSource: remoteDb,
            date: articleDate
        };

        if (typeof rawArticle.MedlineCitation[0].Article[0].Abstract !== 'undefined') {
            rawAbstractSections = rawArticle.MedlineCitation[0].Article[0].Abstract[0].AbstractText;
            abstractSections = [];

            rawAbstractSections.forEach((rawSection: any) => {
                let section: AbstractSection;

                if (typeof rawSection === 'string') {
                    section = {
                        body: rawSection
                    }
                } else {
                    section = {
                        body: rawSection['_']
                    }

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

function parseEutilsDate(eutilsDate: any): Date {
    if (eutilsDate === undefined) {
        return new Date(0);
    }

    try {
        let year = parseInt(eutilsDate[0].Year);
        let month = parseInt(eutilsDate[0].Month);
        let day = parseInt(eutilsDate[0].Day);

        return new Date(year, month - 1, day);
    } catch {
        return new Date(0);
    }
}
