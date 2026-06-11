import React from 'react';
import { X, Cpu, DollarSign, CheckCircle2 } from 'lucide-react';

export interface ModelOption {
    id: string;
    name: string;
    provider: string;
    estimatedCost: number;
    available: boolean;
    quotaInfo: string;
}

export interface EstimationData {
    videoId: string;
    metadata: any;
    transcriptStats: {
        wordCount: number;
        estimatedInputTokens: number;
        estimatedOutputTokens: number;
    };
    models: ModelOption[];
}

interface ModelSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (modelId: string) => void;
    estimationData: EstimationData | null;
}

export const ModelSelectionModal: React.FC<ModelSelectionModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    estimationData
}) => {
    const [selectedModel, setSelectedModel] = React.useState<string>('gemini-2.5-flash');

    if (!isOpen || !estimationData) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-zinc-950/70 backdrop-blur-md animate-[fadeIn_0.25s_ease-out]"
                onClick={onClose}
            />

            <div className="relative bg-zinc-900/90 backdrop-blur-2xl rounded-2xl w-full max-w-2xl border border-white/10 shadow-2xl shadow-black/60 flex flex-col overflow-hidden animate-[slideUp_0.32s_cubic-bezier(0.25,1,0.5,1)]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
                    <div>
                        <h2 className="text-xl font-semibold tracking-tight text-zinc-100 flex items-center gap-2">
                            <Cpu className="w-5 h-5 text-blue-400" />
                            Choose Your Model
                        </h2>
                        <p className="text-sm text-zinc-400 mt-0.5">
                            Pick the translation model — cost is the estimate for the whole video
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">

                    {/* Video Stats */}
                    <div className="bg-zinc-800/30 rounded-xl p-4 border border-white/5">
                        <div className="flex gap-4">
                            <div className="w-32 aspect-video bg-zinc-900 rounded-lg overflow-hidden shrink-0 border border-white/5">
                                {estimationData.metadata?.thumbnail ? (
                                    <img src={estimationData.metadata.thumbnail} className="w-full h-full object-cover" alt="thumbnail" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500">No thumbnail</div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-zinc-100 font-medium truncate mb-1">{estimationData.metadata?.title || 'Unknown video'}</h3>
                                <p className="text-sm text-zinc-400 truncate mb-3">{estimationData.metadata?.channel || 'Unknown channel'}</p>

                                <div className="flex items-center gap-4 text-xs font-medium bg-zinc-900/50 p-2 rounded-lg inline-flex border border-white/5">
                                    <span className="text-zinc-500">Words:  <span className="text-zinc-100 tabular-nums ml-1">{estimationData.transcriptStats.wordCount.toLocaleString()}</span></span>
                                    <span className="text-zinc-500">Est. tokens:  <span className="text-zinc-100 tabular-nums ml-1">~{(estimationData.transcriptStats.estimatedInputTokens + estimationData.transcriptStats.estimatedOutputTokens).toLocaleString()}</span></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Model Options */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-medium text-zinc-500 tracking-normal mb-2">Available Models</h3>

                        {estimationData.models.map((model) => {
                            const isSelected = selectedModel === model.id;
                            const isAvailable = model.available;

                            return (
                                <div
                                    key={model.id}
                                    onClick={() => isAvailable && setSelectedModel(model.id)}
                                    className={`
                                        relative p-4 rounded-xl border transition-[background-color,border-color] duration-200 active:scale-[0.99] cursor-pointer flex items-center gap-4
                                        ${isSelected ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/5 bg-zinc-800/30 hover:border-white/10 hover:bg-zinc-800/60'}
                                        ${!isAvailable ? 'opacity-50 cursor-not-allowed' : ''}
                                    `}
                                >
                                    {/* Selection Radio */}
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'border-blue-500' : 'border-zinc-600'}`}>
                                        {isSelected && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-zinc-100 font-medium">{model.name}</h4>
                                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 border border-white/5 text-zinc-400 font-medium">
                                                    {model.provider}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 text-[11px] font-medium tabular-nums text-zinc-100 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                                                <DollarSign className="w-3 h-3" />
                                                {model.estimatedCost.toFixed(4)}
                                            </div>
                                        </div>
                                        <p className="text-sm text-zinc-400 flex items-center gap-1.5">
                                            {model.quotaInfo}
                                            {isAvailable && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-1" />}
                                        </p>
                                    </div>

                                    {!isAvailable && (
                                        <div className="absolute inset-0 bg-zinc-950/40 rounded-xl" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="h-10 px-5 rounded-xl text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors"
                    >Cancel</button>
                    <button
                        onClick={() => onConfirm(selectedModel)}
                        className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-zinc-100 text-zinc-900 text-sm font-semibold hover:bg-white active:scale-[0.98] transition-all duration-200"
                    >
                        Confirm & Start
                    </button>
                </div>
            </div>
        </div>
    );
};
