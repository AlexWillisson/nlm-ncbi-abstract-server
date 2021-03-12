export interface ExternalArticle {
    type: 'pubmed' | 'omim' | 'hgmd';
    id: string;
    cached_id?: number;
}

export interface ArticleData {
    id: string;
    title: string;
    abstract?: AbstractSection[];
}

export interface AbstractSection {
    label?: string,
    body: string
}
