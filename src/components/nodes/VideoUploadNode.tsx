'use client';

import { Handle, Position } from '@xyflow/react';
import { Video, Upload, Loader2, X } from 'lucide-react';
import { useWorkflowStore, type NodeExecutionStatus } from '@/lib/store';
import type { VideoUploadNodeData } from '@/lib/types';
import { useCallback, useRef, useState, useEffect } from 'react';
import NodeDeleteButton from './NodeDeleteButton';

interface VideoUploadNodeProps {
    id: string;
    data: VideoUploadNodeData & {
        label?: string;
        executionStatus?: NodeExecutionStatus;
        executionError?: string;
    };
    selected?: boolean;
}

export default function VideoUploadNode({ id, data, selected }: VideoUploadNodeProps) {
    const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
    const setNodeOutputCache = useWorkflowStore((state) => state.setNodeOutputCache);
    const isExecuting = useWorkflowStore((state) => state.isExecuting);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const status = data.executionStatus || 'idle';
    const statusClass = {
        idle: 'border-[#2a2a2a]',
        pending: 'border-yellow-500/50',
        running: 'border-[#D4FF3F]/50 shadow-[0_0_12px_rgba(212,255,63,0.2)]',
        success: 'border-emerald-500/50',
        failed: 'border-red-500/50',
        skipped: 'border-[#333]',
    }[status];

    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        console.log(`[VideoUpload ${id}] Uploading file: ${file.name} (${file.size} bytes)`);
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', 'video');
            const response = await fetch('/api/upload', { method: 'POST', body: formData });
            if (response.ok) {
                const result = await response.json();
                console.log(`[VideoUpload ${id}] Upload success. URL: ${result.url}`);
                updateNodeData(id, { videoUrl: result.url, fileName: file.name, output: result.url });
                setNodeOutputCache(id, result.url);
            } else {
                console.error(`[VideoUpload ${id}] Upload failed: ${response.statusText}`);
            }
        } catch (err) {
            console.error(`[VideoUpload ${id}] Upload error:`, err);
        } finally { setIsUploading(false); }
    }, [id, updateNodeData, setNodeOutputCache]);

    // Hydrate cache on mount if data exists
    useEffect(() => {
        if (data.videoUrl) {
            console.log(`[VideoUpload ${id}] Hydrating cache from prop: ${data.videoUrl}`);
            setNodeOutputCache(id, data.videoUrl);
        }
    }, [data.videoUrl, id, setNodeOutputCache]);

    const handleRemove = useCallback(() => {
        updateNodeData(id, { videoUrl: undefined, fileName: undefined, output: undefined });
    }, [id, updateNodeData]);

    return (
        <div className={`relative group w-[260px] rounded-xl bg-[#121212] border transition-all duration-200 ${statusClass} ${selected ? 'border-[#D4FF3F]' : 'hover:border-[#3a3a3a]'}`}>
            <NodeDeleteButton nodeId={id} />

            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#1a1a1a]">
                <div className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-900/20">
                    <Video className="w-3 h-3 text-white" />
                </div>
                <span className="text-[12px] font-medium text-[#e5e5e5] tracking-wide">{data.label || 'Video'}</span>
                {status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-[#D4FF3F] ml-auto" />}
            </div>

            {/* Content */}
            <div className="p-3">
                <input ref={fileInputRef} type="file" accept="video/mp4,video/quicktime,video/webm" onChange={handleFileSelect} className="hidden" disabled={isExecuting || isUploading} />

                {data.videoUrl ? (
                    <div className="relative group">
                        <video src={data.videoUrl} className="w-full h-20 object-cover rounded" />
                        <button onClick={handleRemove} className="absolute top-1 right-1 p-1 bg-black/60 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="w-3 h-3 text-white" />
                        </button>
                        <div className="mt-1 text-[9px] text-[#555] truncate">{data.fileName}</div>
                    </div>
                ) : (
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-16 border border-dashed border-[#333] rounded flex flex-col items-center justify-center gap-1 hover:border-[#D4FF3F]/40 hover:bg-[#D4FF3F]/5 transition-colors"
                        disabled={isExecuting || isUploading}
                    >
                        {isUploading ? <Loader2 className="w-5 h-5 text-[#D4FF3F] animate-spin" /> : (
                            <>
                                <Upload className="w-4 h-4 text-[#555]" />
                                <span className="text-[10px] text-[#555]">Upload</span>
                            </>
                        )}
                    </button>
                )}

                {data.executionError && <div className="mt-2 text-[10px] text-red-400 bg-red-500/10 rounded p-1.5">{data.executionError}</div>}
            </div>

            <Handle type="source" position={Position.Right} id="video-output" className="!w-2.5 !h-2.5 !bg-[#D4FF3F] !border-[#121212] !border-[2px]" />
        </div>
    );
}
