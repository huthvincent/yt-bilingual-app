import { ClickableWords, cn } from './TranscriptBlock';
import { CHUNK_STYLE, type Seg } from '../lib/sentences';

interface SentenceTextProps {
    seg: Seg;
    /** 整句纯英文，作为查词时的语境 */
    context: string;
    onWordLookup: (word: string, sentence: string, start: number, e: React.MouseEvent) => void;
}

/**
 * 渲染一句的 seg：普通文本逐词可点；语块四色高亮 + 中文注释 ruby 在词上方，
 * 整块可点（按短语查词）。复用字幕的 ClickableWords 与 ruby 渲染逻辑。
 */
export const SentenceText: React.FC<SentenceTextProps> = ({ seg, context, onWordLookup }) => (
    <span className="text-[19px] md:text-xl leading-[2.6] tracking-[0.01em] text-zinc-100">
        {seg.map((p, i) => {
            if (typeof p === 'string') {
                return <ClickableWords key={i} text={p} onWordClick={(w, e) => onWordLookup(w, context, 0, e)} />;
            }
            const style = CHUNK_STYLE[p.c];
            return (
                <ruby
                    key={i}
                    className={cn(style.text, 'font-semibold cursor-pointer rounded-sm hover:bg-white/10 transition-colors')}
                    onClick={(e) => { e.stopPropagation(); onWordLookup(p.t, context, 0, e); }}
                >
                    {p.t}
                    <rt className="text-[10px] font-medium text-zinc-400/90 select-none">{p.g}</rt>
                </ruby>
            );
        })}
    </span>
);
