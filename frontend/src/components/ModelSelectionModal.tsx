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
                className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md transition-opacity"
                onClick={onClose}
            />

            <div className="relative bg-[#09090b]/90 rounded-3xl w-full max-w-2xl border border-white/5 shadow-2xl flex flex-col overflow-hidden animate-[fadeIn_0.2s_ease-out] ring-1 ring-white/10">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
                    <div>
                        <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                            <Cpu className="w-5 h-5 text-blue-400" />
                            Model Selection & Estimation
                        </h2>
                        <p className="text-sm text-zinc-400 mt-1">
                            Choose the AI model for processing this video
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">

                    {/* Video Stats */}
                    <div className="bg-zinc-800/30 rounded-2xl p-4 border border-white/5">
                        <div className="flex gap-4">
                            <div className="w-32 h-20 bg-zinc-900 rounded-xl overflow-hidden shrink-0 border border-white/5">
                                {estimationData.metadata?.thumbnail ? (
                                    <img src={estimationData.metadata.thumbnail} className="w-full h-full object-cover" alt="thumbnail" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500">No Image</div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-zinc-100 font-medium truncate mb-1">{estimationData.metadata?.title || 'Unknown Video'}</h3>
                                <p className="text-sm text-zinc-400 truncate mb-3">{estimationData.metadata?.channel || 'Unknown Channel'}</p>

                                <div className="flex items-center gap-4 text-xs font-medium bg-zinc-900/50 p-2 rounded-xl inline-flex border border-white/5">
                                    <span className="text-blue-400">Word Count: <span className="text-zinc-100 ml-1">{estimationData.transcriptStats.wordCount.toLocaleString()}</span></span>
                                    <span className="text-purple-400">Est. Tokens: <span className="text-zinc-100 ml-1">~{(estimationData.transcriptStats.estimatedInputTokens + estimationData.transcriptStats.estimatedOutputTokens).toLocaleString()}</span></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Model Options */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-2">Available Models</h3>

                        {estimationData.models.map((model) => {
                            const isSelected = selectedModel === model.id;
                            const isAvailable = model.available;

                            return (
                                <div
                                    key={model.id}
                                    onClick={() => isAvailable && setSelectedModel(model.id)}
                                    className={`
                                        relative p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-4
                                        ${isSelected ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/5 bg-zinc-800/30 hover:border-white/10 hover:bg-zinc-800/50'}
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
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 border border-white/5 text-zinc-300 font-medium">
                                                    {model.provider}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-1 rounded-md">
                                                <DollarSign className="w-3 h-3" />
                                                {model.estimatedCost.toFixed(4)}
                                            </div>
                                        </div>
                                        <p className="text-sm text-zinc-400 flex items-center gap-1.5">
                                            Quota: {model.quotaInfo}
                                            {isAvailable && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-1" />}
                                        </p>
                                    </div>

                                    {!isAvailable && (
                                        <div className="absolute inset-0 bg-zinc-950/40 rounded-2xl" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-white/5 bg-zinc-900/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(selectedModel)}
                        className="px-6 py-2.5 rounded-xl font-medium text-zinc-900 bg-zinc-100 hover:bg-white transition-all shadow-lg shadow-white/10 flex items-center gap-2 hover:scale-105 active:scale-95"
                    >
                        Confirm & Process
                    </button>
                </div>
            </div>
        </div>
    );
};
