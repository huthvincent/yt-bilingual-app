import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Volume2, Star, Eye, EyeOff, CalendarCheck, Check } from 'lucide-react';
import {
    fetchSentenceLevels, fetchSentenceLevel, segToPlain,
    isDayDone, setDayDone, levelDoneDays, loadZhHidden, saveZhHidden,
    getReviews, toggleReview,
    CHUNK_STYLE, CAT_LABEL,
    type SentenceLevel, type SentenceLevelMeta, type Sentence,
} from '../lib/sentences';
import { SentenceText } from './SentenceText';
import { speak } from '../lib/tts';

interface SentenceViewProps {
    levelId: number;
    onSelectLevel: (id: number) => void;
    onWordLookup: (word: string, sentence: string, start: number, e: React.MouseEvent) => void;
    onToggleFavorite: (sentence: Sentence, levelId: number) => void;
    favoriteIds: string[];
}

export const sentenceFavId = (levelId: number, n: number) => `sentence-L${levelId}-${n}`;

export const SentenceView: React.FC<SentenceViewProps> = ({
    levelId, onSelectLevel, onWordLookup, onToggleFavorite, favoriteIds,
}) => {
    const [levels, setLevels] = useState<SentenceLevelMeta[]>([]);
    const [level, setLevel] = useState<SentenceLevel | null>(null);
    const [query, setQuery] = useState('');
    const [zhHidden, setZhHidden] = useState(loadZhHidden);
    const [doneTick, setDoneTick] = useState(0); // 勾选后强制重算进度
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => { fetchSentenceLevels().then(setLevels).catch(() => {}); }, []);
    useEffect(() => {
        setLevel(null);
        fetchSentenceLevel(levelId).then(setLevel).catch(() => {});
        scrollRef.current?.scrollTo({ top: 0 });
    }, [levelId]);

    const days = useMemo(() => {
        if (!level) return [];
        const byDay = new Map<number, Sentence[]>();
        for (const s of level.sentences) {
            if (!byDay.has(s.d)) byDay.set(s.d, []);
            byDay.get(s.d)!.push(s);
        }
        return [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([d, items]) => ({ d, items }));
    }, [level]);

    const q = query.trim().toLowerCase();
    const matches = (s: Sentence) =>
        !q || (segToPlain(s.seg) + ' ' + s.zh + ' ' + s.seg.map(p => typeof p === 'string' ? '' : p.g).join(' ')).toLowerCase().includes(q);

    const doneDays = level ? levelDoneDays(levelId, level.days) : 0;
    void doneTick; // 依赖 doneTick 触发重算

    const toggleZh = () => { const v = !zhHidden; setZhHidden(v); saveZhHidden(v); };
    const gotoToday = () => {
        if (!level) return;
        const next = days.find(g => !isDayDone(levelId, g.d))?.d ?? days[0]?.d;
        if (next != null) document.getElementById(`sentence-day-${next}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div className="flex-1 min-h-0 flex flex-col bg-transparent">
            {/* 工具栏（chrome 条材质） */}
            <div className="flex-none flex flex-wrap items-center gap-x-3 gap-y-2 px-4 md:px-6 py-2.5 bg-zinc-950/60 backdrop-blur-xl border-b border-white/5 z-20">
                {/* 级别分段控件 */}
                <div className="inline-flex items-center rounded-lg bg-zinc-800/80 p-0.5 border border-white/5">
                    {levels.map(lv => (
                        <button
                            key={lv.id}
                            onClick={() => onSelectLevel(lv.id)}
                            className={`relative px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                                lv.id === levelId ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            {lv.id === levelId && (
                                <motion.span layoutId="sentenceLevelThumb" className="absolute inset-0 bg-zinc-100 rounded-md shadow-sm"
                                    transition={{ type: 'spring', stiffness: 420, damping: 36 }} />
                            )}
                            <span className="relative z-10">{lv.title}</span>
                        </button>
                    ))}
                </div>

                <button
                    onClick={toggleZh}
                    className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-lg border transition-colors ${
                        zhHidden ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-zinc-800/80 text-zinc-400 border-white/5 hover:text-zinc-200'
                    }`}
                    title="隐藏中文，先想英文再核对"
                >
                    {zhHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />} 自测
                </button>
                <button
                    onClick={gotoToday}
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-lg bg-zinc-800/80 text-zinc-400 border border-white/5 hover:text-zinc-200 transition-colors"
                    title="跳到第一个未完成的一天"
                >
                    <CalendarCheck className="w-3.5 h-3.5" /> 今日待背
                </button>

                <div className="relative flex-1 min-w-[140px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    <input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="搜索英文 / 中文 / 注释…"
                        className="w-full h-7 pl-8 pr-3 text-xs rounded-lg bg-zinc-800/80 border border-white/5 text-zinc-200 placeholder-zinc-500 outline-none focus:border-white/10"
                    />
                </div>

                {level && (
                    <span className="text-[11px] text-zinc-500 tabular-nums shrink-0">
                        已背 {doneDays}/{level.days} 天
                    </span>
                )}
            </div>

            {/* 进度条 + 图例 */}
            {level && (
                <div className="flex-none px-4 md:px-6 py-2 bg-zinc-900/40 border-b border-white/5">
                    <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-400 to-sky-400 rounded-full transition-[width] duration-500"
                            style={{ width: `${(doneDays / level.days) * 100}%` }} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                        <span>{level.title} · {level.subtitle}</span>
                        <span className="text-zinc-700">·</span>
                        {(Object.keys(CHUNK_STYLE) as (keyof typeof CHUNK_STYLE)[]).map(c => (
                            <span key={c} className={CHUNK_STYLE[c].text}>■ {CHUNK_STYLE[c].label}</span>
                        ))}
                        <span className="text-zinc-600">中文注释标在词上方</span>
                    </div>
                </div>
            )}

            {/* 句子列表 */}
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 md:px-6 py-5">
                {!level ? (
                    <div className="flex flex-col items-center justify-center py-24 text-zinc-500 text-sm">加载中…</div>
                ) : (
                    <div className="max-w-3xl mx-auto space-y-5 pb-24">
                        {days.map(({ d, items }) => {
                            const shown = items.filter(matches);
                            if (q && shown.length === 0) return null;
                            const done = isDayDone(levelId, d);
                            return (
                                <section key={d} id={`sentence-day-${d}`}
                                    className={`rounded-2xl border overflow-hidden transition-colors ${done ? 'border-emerald-500/20 bg-emerald-500/[0.03]' : 'border-white/5 bg-zinc-900/40'}`}>
                                    <div className="flex items-center gap-3 px-5 py-3 bg-zinc-800/30 border-b border-white/5">
                                        <span className="text-sm font-semibold tracking-tight text-zinc-100">Day {d}</span>
                                        <span className="text-[11px] text-zinc-500 tabular-nums">第 {items[0].n}–{items[items.length - 1].n} 句</span>
                                        <div className="ml-auto flex items-center gap-3">
                                            <button
                                                onClick={() => { setDayDone(levelId, d, !done); setDoneTick(t => t + 1); }}
                                                className={`inline-flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-lg border transition-colors ${
                                                    done ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-zinc-800/60 text-zinc-400 border-white/5 hover:text-zinc-200'
                                                }`}
                                            >
                                                <Check className="w-3.5 h-3.5" /> {done ? '已背完' : '标记已背'}
                                            </button>
                                            {/* 复习打卡：每复习一遍勾一个 */}
                                            <div className="flex items-center gap-1.5" title="每复习一遍打一个勾">
                                                <span className="text-[11px] text-zinc-500 hidden sm:inline">复习</span>
                                                {getReviews(levelId, d).map((checked, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => { toggleReview(levelId, d, i); setDoneTick(t => t + 1); }}
                                                        title={`第 ${i + 1} 遍`}
                                                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                                                            checked
                                                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                                                : 'bg-zinc-800/60 border-white/10 text-transparent hover:border-white/25'
                                                        }`}
                                                    >
                                                        <Check className="w-3 h-3" strokeWidth={3} />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="divide-y divide-white/5">
                                        {shown.map(s => {
                                            const fav = favoriteIds.includes(sentenceFavId(levelId, s.n));
                                            const plain = segToPlain(s.seg);
                                            return (
                                                <div key={s.n} className="group px-5 py-4">
                                                    <div className="flex items-start gap-3">
                                                        <span className="text-[11px] text-zinc-600 tabular-nums pt-2 w-7 shrink-0">{s.n}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <SentenceText seg={s.seg} context={plain} onWordLookup={onWordLookup} />
                                                            <p className={`mt-1.5 text-sm text-zinc-400 leading-relaxed transition ${zhHidden ? 'blur-[5px] hover:blur-0' : ''}`}>
                                                                <span className="text-zinc-600 text-[11px] mr-1.5">译</span>{s.zh}
                                                            </p>
                                                        </div>
                                                        <div className="flex flex-col items-center gap-1 shrink-0">
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400">{CAT_LABEL[s.cat]}</span>
                                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100 transition-opacity">
                                                                <button onClick={() => speak(plain)} title="朗读"
                                                                    className="p-1.5 rounded-lg text-zinc-500 hover:text-blue-400 hover:bg-white/5 transition-colors">
                                                                    <Volume2 className="w-4 h-4" />
                                                                </button>
                                                                <button onClick={() => onToggleFavorite(s, levelId)} title={fav ? '移出生词本' : '加入生词本'}
                                                                    className={`p-1.5 rounded-lg transition-colors hover:bg-white/5 ${fav ? 'text-amber-400' : 'text-zinc-500 hover:text-amber-400'}`}>
                                                                    <Star className="w-4 h-4" fill={fav ? 'currentColor' : 'none'} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
