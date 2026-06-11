import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { subscribeToToasts, type ToastItem } from '../lib/toast';

const TOAST_TTL_MS = 6000;

const styles: Record<ToastItem['type'], { border: string; icon: React.ReactNode }> = {
    error: { border: 'border-red-500/30', icon: <AlertCircle className="w-5 h-5 text-red-400 shrink-0" /> },
    success: { border: 'border-emerald-500/30', icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> },
    info: { border: 'border-blue-500/30', icon: <Info className="w-5 h-5 text-blue-400 shrink-0" /> },
};

export const Toaster = () => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    useEffect(() => {
        return subscribeToToasts((t) => {
            setToasts(prev => [...prev, t]);
            setTimeout(() => {
                setToasts(prev => prev.filter(x => x.id !== t.id));
            }, TOAST_TTL_MS);
        });
    }, []);

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 max-w-md pointer-events-none">
            <AnimatePresence>
                {toasts.map(t => (
                    <motion.div
                        key={t.id}
                        layout
                        initial={{ opacity: 0, y: 12, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
                        transition={{ type: "spring", stiffness: 480, damping: 34, mass: 0.9 }}
                        className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-2xl bg-zinc-900/85 backdrop-blur-xl backdrop-saturate-150 border ${styles[t.type].border} shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_16px_-6px_rgba(0,0,0,0.5),0_24px_64px_-16px_rgba(0,0,0,0.6)]`}
                    >
                        {styles[t.type].icon}
                        <p className="text-sm text-zinc-200 leading-relaxed flex-1">{t.message}</p>
                        <button
                            onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                            className="p-1.5 rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors shrink-0"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};
