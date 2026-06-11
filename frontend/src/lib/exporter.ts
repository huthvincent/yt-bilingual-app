// Export favorites to Anki-importable TSV or generic CSV.
import type { FavoriteItem } from '../components/FavoritesModal';

function downloadFile(filename: string, content: string, mime: string) {
    const blob = new Blob(['﻿' + content], { type: `${mime};charset=utf-8` }); // BOM for Excel
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

const dateStamp = () => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
};

/** One Anki note per favorite: Front / Back / Tags (tab-separated). */
export function exportAnkiTsv(favorites: FavoriteItem[]) {
    const clean = (s: string) => (s || '').replace(/[\t\n\r]+/g, ' ').trim();
    const rows = favorites.map(fav => {
        const isVocab = fav.type === 'vocabulary';
        const front = clean(fav.en_text);
        const backParts = isVocab
            ? [clean(fav.zh_text), fav.context_en ? `例句：${clean(fav.context_en)}` : '']
            : [clean(fav.zh_text)];
        const back = backParts.filter(Boolean).join('<br>');
        const tags = `lingua-nova ${isVocab ? 'vocabulary' : 'sentence'}`;
        return [front, back, tags].join('\t');
    });
    downloadFile(`lingua-nova-anki-${dateStamp()}.tsv`, rows.join('\n'), 'text/tab-separated-values');
}

/** Spreadsheet-friendly CSV with full context columns. */
export function exportCsv(favorites: FavoriteItem[]) {
    const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
    const header = ['类型', '英文', '中文', '例句(英)', '例句(中)', '视频ID', '时间点(秒)', '收藏日期'];
    const rows = favorites.map(fav => [
        esc(fav.type === 'vocabulary' ? '生词' : '句子'),
        esc(fav.en_text),
        esc(fav.zh_text),
        esc(fav.context_en || ''),
        esc(fav.context_zh || ''),
        esc(fav.videoId),
        String(Math.round(fav.start)),
        esc(fav.added_at ? new Date(fav.added_at).toLocaleDateString('zh-CN') : ''),
    ].join(','));
    downloadFile(`lingua-nova-favorites-${dateStamp()}.csv`, [header.join(','), ...rows].join('\n'), 'text/csv');
}
