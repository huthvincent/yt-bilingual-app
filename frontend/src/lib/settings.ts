// Learner profile settings (persisted in localStorage).

export const VOCAB_LEVEL_KEY = 'yt_bilingual_vocab_level';

// Six levels along a vocabulary-size axis (~4k → 20k+ words), named after a
// journey into space — numbers stay backstage, the metaphor does the talking.
export const VOCAB_LEVELS = [
    { id: 'liftoff', label: 'Liftoff', tagline: 'Just left the ground — everyday English is home base' },
    { id: 'orbit', label: 'Orbit', tagline: 'Cruising steadily — subtitles are still good company' },
    { id: 'moonwalk', label: 'Moonwalk', tagline: 'Confident steps on unfamiliar terrain' },
    { id: 'interstellar', label: 'Interstellar', tagline: 'Long-haul listening, rarely needs a lifeline' },
    { id: 'deep-space', label: 'Deep Space', tagline: 'Navigates almost anything without a map' },
    { id: 'supernova', label: 'Supernova', tagline: 'Near-native — only the rarest sparks are new' },
] as const;

export type VocabLevelId = typeof VOCAB_LEVELS[number]['id'];

// Earlier releases stored exam-based ids; map them onto the new axis.
const LEGACY_LEVELS: Record<string, VocabLevelId> = {
    cet4: 'liftoff',
    cet6: 'orbit',
    kaoyan: 'moonwalk',
    ielts: 'interstellar',
    advanced: 'deep-space',
};

export function loadVocabLevel(): VocabLevelId {
    const saved = localStorage.getItem(VOCAB_LEVEL_KEY) || '';
    if (VOCAB_LEVELS.some(l => l.id === saved)) return saved as VocabLevelId;
    if (saved in LEGACY_LEVELS) return LEGACY_LEVELS[saved];
    return 'orbit';
}

export function saveVocabLevel(level: VocabLevelId) {
    localStorage.setItem(VOCAB_LEVEL_KEY, level);
}
