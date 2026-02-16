'use client';

import { useEffect, useState, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Crop, Lock, Unlock, Loader2 } from 'lucide-react';
import { useWorkflowStore } from '@/lib/store';
import type { CropImageNodeData } from '@/lib/types';
import NodeDeleteButton from './NodeDeleteButton';
import {
    cropImageClient,
    ASPECT_RATIOS,
    enforceAspectRatio,
} from '@/lib/crop-engine';
import { useDebounce } from '@/hooks/useDebounce';

interface CropImageNodeProps {
    id: string;
    data: CropImageNodeData & {
        label?: string;
    };
    selected?: boolean;
}

export default function CropImageNode({
    id,
    data,
    selected,
}: CropImageNodeProps) {
    const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
    const getUpstreamOutput = useWorkflowStore((state) => state.getUpstreamOutput);
    const setNodeOutputCache = useWorkflowStore(
        (state) => state.setNodeOutputCache
    );
    const nodeOutputCache = useWorkflowStore(
        (state) => state.nodeOutputCache
    );
    const edges = useWorkflowStore((state) => state.edges);

    const [processing, setProcessing] = useState(false);
    const [aspectRatioLocked, setAspectRatioLocked] = useState(false);
    const [selectedRatio, setSelectedRatio] = useState<string>('free');

    const hasInput = useMemo(
        () => edges.some((e) => e.target === id),
        [edges, id]
    );

    // 🔥 Upstream image comes ONLY from runtime cache
    const upstreamImage = getUpstreamOutput(id);

    // 🔎 Debug upstream
    useEffect(() => {
        console.log(`[Crop:${id}] Upstream image:`, upstreamImage);
    }, [upstreamImage, id]);

    const params = {
        xPercent: data.xPercent ?? 0,
        yPercent: data.yPercent ?? 0,
        widthPercent: data.widthPercent ?? 100,
        heightPercent: data.heightPercent ?? 100,
    };

    const debouncedParams = useDebounce(params, 300);

    // 🔥 Reactive crop processing
    useEffect(() => {
        let isMounted = true;

        const processCrop = async () => {
            if (!upstreamImage) {
                console.warn(`[Crop:${id}] No upstream image found.`);
                return;
            }

            console.log(`[Crop:${id}] Processing crop with params:`, debouncedParams);

            setProcessing(true);

            try {
                const cropped = await cropImageClient(
                    upstreamImage,
                    debouncedParams
                );

                if (!isMounted) return;

                console.log(`[Crop:${id}] Crop success.`);

                // ✅ Only write to runtime cache
                setNodeOutputCache(id, cropped);
            } catch (error) {
                console.error(`[Crop:${id}] Crop failed:`, error);
            } finally {
                if (isMounted) setProcessing(false);
            }
        };

        processCrop();

        return () => {
            isMounted = false;
        };
    }, [debouncedParams, upstreamImage, id, setNodeOutputCache]);

    // Aspect ratio change
    const handleRatioChange = (ratioValue: string) => {
        setSelectedRatio(ratioValue);
        const ratioObj = ASPECT_RATIOS.find((r) => r.value === ratioValue);

        if (ratioObj && ratioObj.ratio !== null) {
            setAspectRatioLocked(true);
            const newParams = enforceAspectRatio(
                params,
                ratioObj.ratio,
                'width'
            );
            updateNodeData(id, newParams);
        } else {
            setAspectRatioLocked(false);
        }
    };

    const handleParamChange = (
        key: keyof typeof params,
        value: number
    ) => {
        let newParams = { ...params, [key]: value };

        if (aspectRatioLocked) {
            const ratioObj = ASPECT_RATIOS.find(
                (r) => r.value === selectedRatio
            );
            if (ratioObj?.ratio) {
                if (key === 'widthPercent') {
                    newParams = enforceAspectRatio(
                        newParams,
                        ratioObj.ratio,
                        'width'
                    );
                } else if (key === 'heightPercent') {
                    newParams = enforceAspectRatio(
                        newParams,
                        ratioObj.ratio,
                        'height'
                    );
                }
            }
        }

        updateNodeData(id, newParams);
    };

    // 🔥 Preview reads ONLY from runtime cache
    const output = nodeOutputCache[id];

    return (
        <div
            className={`relative group w-[260px] rounded-xl bg-[#121212] border border-[#2a2a2a] transition-all duration-200 ${selected
                    ? 'border-[#D4FF3F] shadow-[0_0_15px_-3px_rgba(212,255,63,0.3)]'
                    : 'hover:border-[#3a3a3a]'
                }`}
        >
            <NodeDeleteButton nodeId={id} />

            <Handle
                type="target"
                position={Position.Left}
                id="image-input"
                className="!w-2.5 !h-2.5 !bg-purple-500 !border-[#121212] !border-[2px]"
            />

            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#1a1a1a]">
                <div className="w-5 h-5 rounded-md bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-900/20">
                    <Crop className="w-3 h-3 text-white" />
                </div>
                <span className="text-[12px] font-medium text-[#e5e5e5] tracking-wide">
                    {data.label || 'Crop'}
                </span>
                {processing && (
                    <Loader2 className="w-3 h-3 animate-spin text-[#D4FF3F] ml-auto" />
                )}
            </div>

            <div className="p-3 space-y-3">
                {!hasInput && (
                    <div className="px-2 py-1.5 bg-yellow-500/5 border border-yellow-500/10 rounded text-[10px] text-yellow-200/70 font-medium">
                        Waiting for image input...
                    </div>
                )}

                {/* Aspect Ratio */}
                <div className="flex items-center gap-2">
                    <select
                        value={selectedRatio}
                        onChange={(e) => handleRatioChange(e.target.value)}
                        className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-[11px] text-[#ccc] px-2 py-1"
                    >
                        {ASPECT_RATIOS.map((r) => (
                            <option key={r.value} value={r.value}>
                                {r.label}
                            </option>
                        ))}
                    </select>

                    <button
                        onClick={() =>
                            setAspectRatioLocked(!aspectRatioLocked)
                        }
                        className={`p-1 rounded ${aspectRatioLocked
                                ? 'text-[#D4FF3F]'
                                : 'text-[#444]'
                            }`}
                    >
                        {aspectRatioLocked ? (
                            <Lock className="w-3 h-3" />
                        ) : (
                            <Unlock className="w-3 h-3" />
                        )}
                    </button>
                </div>

                {/* Sliders */}
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { label: 'X', key: 'xPercent', val: params.xPercent },
                        { label: 'Y', key: 'yPercent', val: params.yPercent },
                        { label: 'W', key: 'widthPercent', val: params.widthPercent },
                        { label: 'H', key: 'heightPercent', val: params.heightPercent },
                    ].map(({ label, key, val }) => (
                        <div key={key}>
                            <div className="flex justify-between text-[9px] text-[#444] mb-0.5">
                                <span>{label}</span>
                                <span>{Math.round(val)}%</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={val}
                                onChange={(e) =>
                                    handleParamChange(
                                        key as keyof typeof params,
                                        Number(e.target.value)
                                    )
                                }
                                className="w-full h-1 bg-[#1a1a1a] rounded-full cursor-pointer"
                            />
                        </div>
                    ))}
                </div>

                {/* Preview */}
                {output && (
                    <div className="pt-2 border-t border-[#1a1a1a]">
                        <div className="overflow-hidden rounded bg-[#0a0a0a] border border-[#1a1a1a]">
                            <img
                                src={output}
                                alt="Cropped"
                                className="w-full h-auto object-contain max-h-[140px]"
                            />
                        </div>
                    </div>
                )}
            </div>

            <Handle
                type="source"
                position={Position.Right}
                id="image-output"
                className="!w-2.5 !h-2.5 !bg-[#D4FF3F] !border-[#121212] !border-[2px]"
            />
        </div>
    );
}