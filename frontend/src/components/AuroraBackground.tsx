import { useEffect, useRef } from 'react';

/**
 * Fancy layered home-screen background:
 * aurora blobs → rotating halo → grid → rising particles → shooting stars
 * → mouse spotlight → film grain. Pure CSS/GPU animations (see index.css),
 * honors prefers-reduced-motion.
 */
export const AuroraBackground = () => {
    const ref = useRef<HTMLDivElement>(null);

    // Mouse-following spotlight (rAF-throttled, updates CSS vars only)
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        let raf = 0;
        const onMove = (e: MouseEvent) => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                el.style.setProperty('--mx', `${e.clientX}px`);
                el.style.setProperty('--my', `${e.clientY}px`);
            });
        };
        window.addEventListener('mousemove', onMove);
        return () => {
            window.removeEventListener('mousemove', onMove);
            cancelAnimationFrame(raf);
        };
    }, []);

    return (
        <div ref={ref} className="aurora-bg" aria-hidden="true">
            <div className="aurora-blob aurora-blob-1" />
            <div className="aurora-blob aurora-blob-2" />
            <div className="aurora-blob aurora-blob-3" />
            <div className="aurora-blob aurora-blob-4" />
            <div className="aurora-halo" />
            <div className="aurora-grid" />
            <div className="aurora-particles">
                {Array.from({ length: 24 }).map((_, i) => (
                    <span key={i} style={{ '--i': i } as React.CSSProperties} />
                ))}
            </div>
            <div className="aurora-shooting aurora-shooting-1" />
            <div className="aurora-shooting aurora-shooting-2" />
            <div className="aurora-spotlight" />
            <div className="aurora-noise" />
        </div>
    );
};
