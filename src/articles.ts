export type ArticleType = 'pubmed' | 'omim' | 'hgmd' | '';

export interface ExternalArticle {
    type: ArticleType;
    id: string;
    cached_id?: number;
    externalArticleId: number;
}

export interface ArticleData {
    id: string;
    title: string;
    articleType: ArticleType;
    abstract?: AbstractSection[];
}

export interface AbstractSection {
    label?: string,
    body: string
}
