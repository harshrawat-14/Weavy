'use client';

import { Handle, Position } from '@xyflow/react';
import { Film, Loader2, Play } from 'lucide-react';
import { useWorkflowStore, type NodeExecutionStatus } from '@/lib/store';
import { useNodeExecution } from '@/lib/useNodeExecution';
import type { ExtractFrameNodeData } from '@/lib/types';
import { useEffect } from 'react';
import NodeDeleteButton from './NodeDeleteButton';

interface ExtractFrameNodeProps {
    id: string;
    data: ExtractFrameNodeData & {
        label?: string;
        executionStatus?: NodeExecutionStatus;
        executionOutput?: string;
        executionError?: string;
    };
    selected?: boolean;
}

export default function ExtractFrameNode({ id, data, selected }: ExtractFrameNodeProps) {
    const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
    const getUpstreamOutput = useWorkflowStore((state) => state.getUpstreamOutput);
    const nodeOutputCache = useWorkflowStore((state) => state.nodeOutputCache);
    const edges = useWorkflowStore((state) => state.edges);
    const isExecuting = useWorkflowStore((state) => state.isExecuting);
    const { runNode } = useNodeExecution();

    const hasInput = edges.some((e) => e.target === id);
    const upstreamVideo = getUpstreamOutput(id);
    const status = data.executionStatus || 'idle';

    // Show output from cache (reactive)
    const framePreview = nodeOutputCache[id];

    // Auto-run when upstream video or timestamp changes (Reactive Flow)
    useEffect(() => {
        // Log dependency changes for debugging reactivity
        console.log(`[ExtractFrame ${id}] Effect Dependency Change - Upstream: ${!!upstreamVideo}, Timestamp: ${data.timestamp}, Status: ${status}`);

        if (upstreamVideo && data.timestamp) {
            const timer = setTimeout(() => {
                // Only run if not already running (to avoid infinite loops/race conditions, though runNode handles most)
                if (status !== 'running') {
                    console.log(`[ExtractFrame ${id}] Auto-triggering execution (debounced)`);
                    runNode(id);
                } else {
                    console.log(`[ExtractFrame ${id}] Skipping auto-trigger (already running)`);
                }
            }, 1000); // 1s debounce to allow typing timestamp
            return () => clearTimeout(timer);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [upstreamVideo, data.timestamp, id, runNode]); // omitting status to prevent infinite loop


    const handleRun = () => {
        if (!upstreamVideo) return;
        runNode(id);
    };

    const statusClass = {
        idle: 'border-[#2a2a2a]',
        pending: 'border-yellow-500/50',
        running: 'border-[#D4FF3F]/50 shadow-[0_0_12px_rgba(212,255,63,0.2)]',
        success: 'border-emerald-500/50',
        failed: 'border-red-500/50',
        skipped: 'border-[#333]',
    }[status];

    return (
        <div className={`relative group w-[260px] rounded-xl bg-[#121212] border transition-all duration-200 ${statusClass} ${selected ? 'border-[#D4FF3F]' : 'hover:border-[#3a3a3a]'}`}>
            <NodeDeleteButton nodeId={id} />
            <Handle type="target" position={Position.Left} id="video-input" className="!w-2.5 !h-2.5 !bg-cyan-500 !border-[#121212] !border-[2px]" />

            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#1a1a1a]">
                <div className="w-5 h-5 rounded-md bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-lg shadow-cyan-900/20">
                    <Film className="w-3 h-3 text-white" />
                </div>
                <span className="text-[12px] font-medium text-[#e5e5e5] tracking-wide">{data.label || 'Extract Frame'}</span>

                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={handleRun}
                        disabled={!upstreamVideo || status === 'running' || isExecuting}
                        className={`p-1 rounded transition-colors ${!upstreamVideo || status === 'running' || isExecuting ? 'text-[#333] cursor-not-allowed' : 'text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300'}`}
                        title="Run Extraction"
                    >
                        {status === 'running' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="p-3 space-y-3">
                {!hasInput && (
                    <div className="px-2 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded text-[10px] text-yellow-400">
                        ⚡ Connect video
                    </div>
                )}

                <div>
                    <div className="flex justify-between items-center mb-1.5">
                        <label className="text-[9px] text-[#555] uppercase font-semibold tracking-wider">Timestamp</label>
                        <span className="text-[10px] text-[#D4FF3F] font-mono">{data.timestamp || '50%'}</span>
                    </div>

                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        className="w-full h-1.5 bg-[#2a2a2a] rounded-lg appearance-none cursor-pointer accent-[#D4FF3F] hover:accent-[#bfff00] transition-all"
                        value={parseInt((data.timestamp || '50%').replace('%', '')) || 0}
                        onChange={(e) => updateNodeData(id, { timestamp: `${e.target.value}%` })}
                        disabled={isExecuting}
                    />
                    <div className="flex justify-between text-[9px] text-[#444] mt-1 font-mono">
                        <span>0%</span>
                        <span>50%</span>
                        <span>100%</span>
                    </div>
                </div>

                {framePreview ? (
                    <div className="pt-2 border-t border-[#1a1a1a]">
                        <div className="relative group overflow-hidden rounded-md border border-[#333]">
                            <img src={framePreview} alt="Extracted frame" className="w-full h-28 object-cover bg-black/20" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                                <span className="text-[10px] text-white/80">Extracted Frame</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    status === 'success' && !framePreview ? (
                        <div className="text-[10px] text-yellow-500/80 text-center py-2 bg-yellow-500/5 rounded">
                            Output not in cache. Try re-running.
                        </div>
                    ) : null
                )}

                {data.executionError && <div className="text-[10px] text-red-400 bg-red-500/10 rounded p-2 border border-red-500/20">{data.executionError}</div>}
            </div>

            <Handle type="source" position={Position.Right} id="image-output" className="!w-2.5 !h-2.5 !bg-[#D4FF3F] !border-[#121212] !border-[2px]" />
        </div>
    );
}
