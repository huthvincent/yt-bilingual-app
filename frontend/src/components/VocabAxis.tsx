import { motion, AnimatePresence } from 'framer-motion';
import { VOCAB_LEVELS, type VocabLevelId } from '../lib/settings';

interface VocabAxisProps {
    value: VocabLevelId;
    onChange: (level: VocabLevelId) => void;
}

/**
 * Vocabulary level as a journey along an axis: six stops from Liftoff to
 * Supernova. No numbers — the gradient fills toward deeper space as the
 * learner's vocabulary grows.
 */
export const VocabAxis: React.FC<VocabAxisProps> = ({ value, onChange }) => {
    const index = Math.max(0, VOCAB_LEVELS.findIndex(l => l.id === value));
    const pct = (index / (VOCAB_LEVELS.length - 1)) * 100;
    const selected = VOCAB_LEVELS[index];

    return (
        <div className="max-w-2xl mx-auto w-full select-none">
            <p className="text-center text-xs font-medium text-zinc-500 mb-3">
                How far has your English traveled?
            </p>

            {/* Track */}
            <div className="relative h-6 mx-3">
                {/* base rail */}
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[3px] rounded-full bg-white/10" />
                {/* lit portion up to the selected stop */}
                <motion.div
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-[3px] rounded-full bg-gradient-to-r from-sky-400 via-violet-400 to-pink-400 shadow-[0_0_12px_rgba(139,92,246,0.5)]"
                    initial={false}
                    animate={{ width: `${pct}%` }}
                    transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                />
                {/* stops */}
                {VOCAB_LEVELS.map((level, i) => {
                    const left = `${(i / (VOCAB_LEVELS.length - 1)) * 100}%`;
                    const passed = i <= index;
                    return (
                        <button
                            key={level.id}
                            type="button"
                            onClick={() => onChange(level.id)}
                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 p-2 group"
                            style={{ left }}
                            title={level.label}
                        >
                            <span className={`block w-2 h-2 rounded-full transition-colors duration-200 ${
                                passed ? 'bg-zinc-100' : 'bg-zinc-600 group-hover:bg-zinc-400'
                            }`} />
                        </button>
                    );
                })}
                {/* glowing thumb on the selected stop */}
                <motion.span
                    className="absolute top-1/2 w-5 h-5 rounded-full bg-zinc-50 shadow-[0_0_0_4px_rgba(139,92,246,0.25),0_0_18px_rgba(139,92,246,0.6)] pointer-events-none"
                    initial={false}
                    animate={{ left: `${pct}%` }}
                    style={{ y: '-50%', x: '-50%' }}
                    transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                />
            </div>

            {/* Stop names */}
            <div className="relative h-5 mx-3 mt-1.5">
                {VOCAB_LEVELS.map((level, i) => (
                    <button
                        key={level.id}
                        type="button"
                        onClick={() => onChange(level.id)}
                        className={`absolute -translate-x-1/2 text-[11px] font-medium whitespace-nowrap transition-colors duration-200 ${
                            i === index ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                        style={{ left: `${(i / (VOCAB_LEVELS.length - 1)) * 100}%` }}
                    >
                        {level.label}
                    </button>
                ))}
            </div>

            {/* Tagline for the selected stop */}
            <div className="h-5 mt-2 text-center overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.p
                        key={selected.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="text-xs text-zinc-500"
                    >
                        {selected.tagline}
                    </motion.p>
                </AnimatePresence>
            </div>
        </div>
    );
};
