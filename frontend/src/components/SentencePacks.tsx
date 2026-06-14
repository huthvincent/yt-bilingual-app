import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, ChevronRight } from 'lucide-react';
import { TiltCard } from './TiltCard';
import { fetchSentenceLevels, levelPercent, type SentenceLevelMeta } from '../lib/sentences';

interface SentencePacksProps {
    onSelectLevel: (id: number) => void;
}

/** 首页入口卡：列出 5 册句子精背及各自进度。 */
export const SentencePacks: React.FC<SentencePacksProps> = ({ onSelectLevel }) => {
    const [levels, setLevels] = useState<SentenceLevelMeta[]>([]);

    useEffect(() => { fetchSentenceLevels().then(setLevels).catch(() => {}); }, []);
    if (levels.length === 0) return null;

    return (
        <TiltCard className="glass-panel rounded-3xl p-6 overflow-hidden">
            <div className="flex items-center gap-2 mb-5 text-zinc-100">
                <GraduationCap className="w-5 h-5 text-emerald-400" />
                <h3 className="text-[17px] font-semibold tracking-tight">句子精背 · Sentence Packs</h3>
                <span className="text-xs text-zinc-500 ml-1">背一批精选的地道句子</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {levels.map(lv => {
                    const pct = levelPercent(lv.id, lv.days);
                    return (
                        <motion.button
                            key={lv.id}
                            whileTap={{ scale: 0.98 }}
                            transition={{ type: 'spring', stiffness: 550, damping: 35 }}
                            onClick={() => onSelectLevel(lv.id)}
                            className="group/lv text-left p-3 rounded-xl bg-zinc-800/30 hover:bg-zinc-800/60 border border-white/5 hover:border-white/10 transition-colors"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-zinc-200">{lv.title}</span>
                                <ChevronRight className="w-4 h-4 text-zinc-600 group-hover/lv:text-zinc-400 transition-colors" />
                            </div>
                            <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{lv.subtitle}</p>
                            <div className="mt-2.5 h-1 rounded-full bg-zinc-800 overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-emerald-400 to-sky-400 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <p className="text-[10px] text-zinc-600 mt-1 tabular-nums">{lv.count} 句 · 已背 {pct}%</p>
                        </motion.button>
                    );
                })}
            </div>
        </TiltCard>
    );
};
