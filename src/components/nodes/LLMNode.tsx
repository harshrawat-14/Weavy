'use client';

import { Handle, Position } from '@xyflow/react';
import { Sparkles, Loader2, Play } from 'lucide-react';
import { useWorkflowStore, type NodeExecutionStatus } from '@/lib/store';
import type { LLMNodeData } from '@/lib/types';
import NodeDeleteButton from './NodeDeleteButton';
import { useNodeExecution } from '@/lib/useNodeExecution';

interface LLMNodeProps {
    id: string;
    data: LLMNodeData & {
        label?: string;
        executionStatus?: NodeExecutionStatus;
        executionOutput?: unknown;
        executionError?: string;
    };
    selected?: boolean;
}

export default function LLMNode({ id, data, selected }: LLMNodeProps) {
    const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
    const edges = useWorkflowStore((state) => state.edges);
    const { runNode } = useNodeExecution();

    const hasInput = edges.some((e) => e.target === id);
    const status = data.executionStatus || 'idle';
    const isRunning = status === 'running' || status === 'pending';

    const statusClass = {
        idle: 'border-[#2a2a2a]',
        pending: 'border-yellow-500/50',
        running: 'border-[#D4FF3F]/50 shadow-[0_0_15px_-3px_rgba(212,255,63,0.3)]',
        success: 'border-emerald-500/50',
        failed: 'border-red-500/50',
        skipped: 'border-[#333]',
    }[status];

    const handleRun = (e: React.MouseEvent) => {
        e.stopPropagation();
        runNode(id);
    };

    return (
        <div className={`relative group w-[280px] rounded-xl bg-[#121212] border transition-all duration-200 ${statusClass} ${selected ? 'border-[#D4FF3F]' : 'hover:border-[#3a3a3a]'}`}>
            <NodeDeleteButton nodeId={id} />
            <Handle type="target" position={Position.Left} id="llm-input" className="!w-2.5 !h-2.5 !bg-violet-500 !border-[#121212] !border-[2px]" />

            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#1a1a1a]">
                <div className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-900/20">
                    <Sparkles className="w-3 h-3 text-white" />
                </div>
                <span className="text-[12px] font-medium text-[#e5e5e5] tracking-wide">LLM (Groq AI)</span>

                <div className="ml-auto flex items-center gap-2">
                    {/* Run Button */}
                    <button
                        onClick={handleRun}
                        disabled={isRunning}
                        className={`
                            flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all
                            ${isRunning
                                ? 'bg-[#1a1a1a] text-[#666] cursor-not-allowed'
                                : 'bg-[#D4FF3F] text-black hover:bg-[#bce335] hover:shadow-[0_0_10px_rgba(212,255,63,0.3)] transform hover:scale-105 active:scale-95'
                            }
                        `}
                    >
                        {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
                        <span>{isRunning ? 'Running' : 'Run'}</span>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="p-3 space-y-3">
                {!hasInput && (
                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-yellow-500/5 border border-yellow-500/10 rounded text-[10px] text-yellow-200/70">
                        ⚡ Connect input prompt
                    </div>
                )}

                <div>
                    <label className="text-[9px] text-[#555] font-medium uppercase tracking-wider mb-1 block">System Requirement</label>
                    <textarea
                        className="w-full px-2 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-[11px] text-[#e5e5e5] placeholder-[#444] focus:outline-none focus:border-[#444] resize-none transition-colors"
                        placeholder="Optional: You are a helpful assistant..."
                        rows={2}
                        value={data.systemPrompt || ''}
                        onChange={(e) => updateNodeData(id, { systemPrompt: e.target.value })}
                        disabled={isRunning}
                    />
                </div>

                {(data.executionOutput || data.output) && (() => {
                    const outputVal = String(data.executionOutput || data.output);
                    const isImage = outputVal.startsWith('data:image/');
                    return (
                        <div className="pt-2 border-t border-[#1a1a1a]">
                            <label className="text-[9px] text-emerald-400 font-medium uppercase tracking-wider mb-1 block">Generated Result</label>
                            {isImage ? (
                                <img src={outputVal} alt="Generated" className="w-full rounded-lg border border-[#2a2a2a] shadow-sm" />
                            ) : (
                                <div className="text-[11px] text-[#ccc] bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-2.5 max-h-[120px] overflow-auto leading-relaxed custom-scrollbar">
                                    {outputVal}
                                </div>
                            )}
                        </div>
                    );
                })()}

                {data.executionError && (
                    <div className="text-[10px] text-red-400 bg-red-500/5 border border-red-500/10 rounded p-2">
                        {data.executionError}
                    </div>
                )}
            </div>

            <Handle type="source" position={Position.Right} id="text-output" className="!w-2.5 !h-2.5 !bg-[#D4FF3F] !border-[#121212] !border-[2px]" />
        </div>
    );
}
