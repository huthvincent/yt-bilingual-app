// Learner profile settings (persisted in localStorage).

export const VOCAB_LEVEL_KEY = 'yt_bilingual_vocab_level';

export const VOCAB_LEVELS = [
    { id: 'cet4', label: '四级' },
    { id: 'cet6', label: '六级' },
    { id: 'kaoyan', label: '考研' },
    { id: 'ielts', label: '雅思 / 托福' },
    { id: 'advanced', label: '接近母语' },
] as const;

export type VocabLevelId = typeof VOCAB_LEVELS[number]['id'];

export function loadVocabLevel(): VocabLevelId {
    const saved = localStorage.getItem(VOCAB_LEVEL_KEY);
    return (VOCAB_LEVELS.some(l => l.id === saved) ? saved : 'cet6') as VocabLevelId;
}

export function saveVocabLevel(level: VocabLevelId) {
    localStorage.setItem(VOCAB_LEVEL_KEY, level);
}
