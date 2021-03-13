export type ArticleType = 'pubmed' | 'omim' | 'hgmd' | '';

export interface ExternalArticle {
    type: ArticleType;
    publicId: string;
    cache_id?: number;
    id: number;
}

export interface ArticleData {
    id: string;
    title: string;
    articleSource: ArticleType;
    abstract?: AbstractSection[];
}

export interface AbstractSection {
    label?: string,
    body: string
}
