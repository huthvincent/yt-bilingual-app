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
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            <div className="relative bg-gray-900 rounded-2xl w-full max-w-2xl border border-gray-700 shadow-2xl flex flex-col overflow-hidden animate-[fadeIn_0.2s_ease-out]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-gray-900/50">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Cpu className="w-5 h-5 text-purple-400" />
                            Model Selection & Estimation
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">
                            Choose the AI model for processing this video
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">

                    {/* Video Stats */}
                    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                        <div className="flex gap-4">
                            <div className="w-32 h-20 bg-gray-900 rounded-lg overflow-hidden shrink-0 border border-gray-700">
                                {estimationData.metadata?.thumbnail ? (
                                    <img src={estimationData.metadata.thumbnail} className="w-full h-full object-cover" alt="thumbnail" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">No Image</div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-white font-medium truncate mb-1">{estimationData.metadata?.title || 'Unknown Video'}</h3>
                                <p className="text-sm text-gray-400 truncate mb-3">{estimationData.metadata?.channel || 'Unknown Channel'}</p>

                                <div className="flex items-center gap-4 text-xs font-medium bg-gray-900 p-2 rounded-lg inline-flex border border-gray-800">
                                    <span className="text-blue-400">Word Count: <span className="text-white ml-1">{estimationData.transcriptStats.wordCount.toLocaleString()}</span></span>
                                    <span className="text-purple-400">Est. Tokens: <span className="text-white ml-1">~{(estimationData.transcriptStats.estimatedInputTokens + estimationData.transcriptStats.estimatedOutputTokens).toLocaleString()}</span></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Model Options */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Available Models</h3>

                        {estimationData.models.map((model) => {
                            const isSelected = selectedModel === model.id;
                            const isAvailable = model.available;

                            return (
                                <div
                                    key={model.id}
                                    onClick={() => isAvailable && setSelectedModel(model.id)}
                                    className={`
                                        relative p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-4
                                        ${isSelected ? 'border-purple-500 bg-purple-500/10' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}
                                        ${!isAvailable ? 'opacity-50 cursor-not-allowed' : ''}
                                    `}
                                >
                                    {/* Selection Radio */}
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'border-purple-500' : 'border-gray-500'}`}>
                                        {isSelected && <div className="w-2.5 h-2.5 bg-purple-500 rounded-full" />}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-white font-medium">{model.name}</h4>
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-300 font-medium">
                                                    {model.provider}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 text-green-400 font-semibold bg-green-400/10 px-2 py-1 rounded-md">
                                                <DollarSign className="w-3 h-3" />
                                                {model.estimatedCost.toFixed(4)}
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-400 flex items-center gap-1.5">
                                            Quota: {model.quotaInfo}
                                            {isAvailable && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-1" />}
                                        </p>
                                    </div>

                                    {!isAvailable && (
                                        <div className="absolute inset-0 bg-gray-900/40 rounded-xl" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-800 bg-gray-800 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-lg font-medium text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(selectedModel)}
                        className="px-6 py-2.5 rounded-lg font-medium text-white bg-purple-600 hover:bg-purple-500 transition-colors shadow-lg shadow-purple-900/50 flex items-center gap-2"
                    >
                        Confirm & Process
                    </button>
                </div>
            </div>
        </div>
    );
};
