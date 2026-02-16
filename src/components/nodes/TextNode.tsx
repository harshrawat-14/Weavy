'use client';

import { useState, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Type, Loader2, Paperclip, X } from 'lucide-react';
import { useWorkflowStore, type NodeExecutionStatus } from '@/lib/store';
import type { TextNodeData } from '@/lib/types';
import NodeDeleteButton from './NodeDeleteButton';

interface Attachment {
    url: string;
    name: string;
    type: 'image' | 'pdf';
}

interface TextNodeProps {
    id: string;
    data: TextNodeData & {
        label?: string;
        executionStatus?: NodeExecutionStatus;
        executionOutput?: unknown;
        executionError?: string;
        attachments?: Attachment[];
    };
    selected?: boolean;
}

export default function TextNode({ id, data, selected }: TextNodeProps) {
    const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
    const isExecuting = useWorkflowStore((state) => state.isExecuting);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const status = data.executionStatus || 'idle';
    const attachments = data.attachments || [];

    const statusClass = {
        idle: 'border-[#2a2a2a]',
        pending: 'border-yellow-500/50',
        running: 'border-[#D4FF3F]/50 shadow-[0_0_12px_rgba(212,255,63,0.2)]',
        success: 'border-emerald-500/50',
        failed: 'border-red-500/50',
        skipped: 'border-[#333]',
    }[status];

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const isImage = file.type.startsWith('image/');
        const isPdf = file.type === 'application/pdf';
        if (!isImage && !isPdf) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const response = await fetch('/api/upload', { method: 'POST', body: formData });
            if (response.ok) {
                const { url } = await response.json();
                updateNodeData(id, { attachments: [...attachments, { url, name: file.name, type: isImage ? 'image' : 'pdf' }] });
            }
        } catch { } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className={`relative group w-[260px] rounded-xl bg-[#121212] border transition-all duration-200 ${statusClass} ${selected ? 'border-[#D4FF3F]' : 'hover:border-[#3a3a3a]'}`}>
            <NodeDeleteButton nodeId={id} />
            <Handle type="target" position={Position.Left} id="text-input" className="!w-2.5 !h-2.5 !bg-blue-500 !border-[#121212] !border-[2px]" />

            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#1a1a1a]">
                <div className="w-5 h-5 rounded-md bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-900/20">
                    <Type className="w-3 h-3 text-white" />
                </div>
                <span className="text-[12px] font-medium text-[#e5e5e5] tracking-wide">{data.label || 'Prompt'}</span>
                {status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-[#D4FF3F] ml-auto" />}
            </div>

            {/* Content */}
            <div className="p-3 space-y-2">
                <textarea
                    className="w-full px-2 py-1.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-[11px] text-[#e5e5e5] placeholder-[#555] focus:outline-none focus:border-[#D4FF3F]/40 resize-none"
                    placeholder="Enter prompt..."
                    rows={3}
                    value={data.userMessage || ''}
                    onChange={(e) => updateNodeData(id, { userMessage: e.target.value })}
                    disabled={isExecuting}
                />

                {/* Attachments */}
                <div className="flex items-center gap-1.5">
                    <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleFileSelect} className="hidden" />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading || isExecuting}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] text-[#666] hover:text-[#999] bg-[#0a0a0a] border border-[#2a2a2a] rounded hover:border-[#3a3a3a] transition-colors"
                    >
                        {isUploading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Paperclip className="w-2.5 h-2.5" />}
                        Attach
                    </button>
                    {attachments.map((a, i) => (
                        <div key={i} className="flex items-center gap-1 px-1.5 py-0.5 bg-[#1a1a1a] rounded text-[9px] text-[#888]">
                            {a.type === 'image' ? <img src={a.url} className="w-3 h-3 rounded object-cover" /> : '📄'}
                            <span className="max-w-[40px] truncate">{a.name}</span>
                            <button onClick={() => updateNodeData(id, { attachments: attachments.filter((_, j) => j !== i) })} className="text-[#555] hover:text-red-400">
                                <X className="w-2 h-2" />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Output */}
                {data.output && (
                    <div className="pt-2 border-t border-[#1a1a1a]">
                        <div className="text-[10px] text-[#888] bg-[#0a0a0a] rounded p-2 max-h-[60px] overflow-auto">{data.output}</div>
                    </div>
                )}
                {data.executionError && (
                    <div className="text-[10px] text-red-400 bg-red-500/10 rounded p-1.5">{data.executionError}</div>
                )}
            </div>

            <Handle type="source" position={Position.Right} id="text-output" className="!w-2.5 !h-2.5 !bg-[#D4FF3F] !border-[#121212] !border-[2px]" />
        </div>
    );
}
