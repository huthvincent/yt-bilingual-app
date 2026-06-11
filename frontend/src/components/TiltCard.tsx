import { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface TiltCardProps {
    className?: string;
    children: React.ReactNode;
}

const MAX_TILT_DEG = 3;

/**
 * Subtle 3D tilt that follows the cursor, plus an aurora-tinted spotlight
 * inside the card (CSS vars --spot-x/--spot-y, styled in index.css).
 * Tilt is skipped under prefers-reduced-motion; the spotlight stays.
 */
export const TiltCard: React.FC<TiltCardProps> = ({ className, children }) => {
    const ref = useRef<HTMLDivElement>(null);

    const px = useMotionValue(0.5);
    const py = useMotionValue(0.5);
    const sx = useSpring(px, { stiffness: 220, damping: 24, mass: 0.6 });
    const sy = useSpring(py, { stiffness: 220, damping: 24, mass: 0.6 });
    const rotateX = useTransform(sy, [0, 1], [MAX_TILT_DEG, -MAX_TILT_DEG]);
    const rotateY = useTransform(sx, [0, 1], [-MAX_TILT_DEG, MAX_TILT_DEG]);

    const reduceMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        if (!reduceMotion) {
            px.set(x);
            py.set(y);
        }
        // Spotlight position via CSS vars — no React re-render per mousemove
        el.style.setProperty('--spot-x', `${(x * 100).toFixed(1)}%`);
        el.style.setProperty('--spot-y', `${(y * 100).toFixed(1)}%`);
    };

    const handleMouseLeave = () => {
        px.set(0.5);
        py.set(0.5);
    };

    return (
        <motion.div
            ref={ref}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={reduceMotion ? undefined : { rotateX, rotateY, transformPerspective: 1000 }}
            className={`tilt-card ${className ?? ''}`}
        >
            <div className="tilt-spotlight" aria-hidden="true" />
            {children}
        </motion.div>
    );
};
