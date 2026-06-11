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
                        initial={{ opacity: 0, y: 20, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.96 }}
                        className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-2xl bg-zinc-900/95 backdrop-blur-xl border ${styles[t.type].border} shadow-2xl shadow-black/40`}
                    >
                        {styles[t.type].icon}
                        <p className="text-sm text-zinc-200 leading-relaxed flex-1">{t.message}</p>
                        <button
                            onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                            className="p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};
