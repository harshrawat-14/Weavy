'use client';

import { useState } from 'react';
import { Type, ImageIcon, Crop, Video, Film, Sparkles, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { NodeTypes, NodeType } from '@/lib/types';
import { useWorkflowStore } from '@/lib/store';

interface NodePaletteItem {
    type: NodeType;
    label: string;
    icon: React.ReactNode;
    gradient: string;
}

const categories = [
    {
        name: 'Inputs',
        items: [
            { type: NodeTypes.TEXT, label: 'Prompt', icon: <Type className="w-3 h-3" />, gradient: 'from-blue-500 to-cyan-400' },
            { type: NodeTypes.IMAGE_UPLOAD, label: 'Image', icon: <ImageIcon className="w-3 h-3" />, gradient: 'from-orange-500 to-red-500' },
            { type: NodeTypes.VIDEO_UPLOAD, label: 'Video', icon: <Video className="w-3 h-3" />, gradient: 'from-indigo-500 to-blue-500' },
        ]
    },
    {
        name: 'Processing',
        items: [
            { type: NodeTypes.CROP_IMAGE, label: 'Crop', icon: <Crop className="w-3 h-3" />, gradient: 'from-purple-500 to-pink-500' },
            { type: NodeTypes.EXTRACT_FRAME, label: 'Extract Frame', icon: <Film className="w-3 h-3" />, gradient: 'from-cyan-500 to-teal-500' },
        ]
    },
    {
        name: 'Models',
        items: [
            { type: NodeTypes.LLM, label: 'Groq AI', icon: <Sparkles className="w-3 h-3" />, gradient: 'from-violet-500 to-fuchsia-500' },
        ]
    }
];

export default function NodePalette() {
    const { addNode, nodes } = useWorkflowStore();
    const [expanded, setExpanded] = useState<Record<string, boolean>>({ Inputs: true, Processing: true, Models: true });
    const [addedFeedback, setAddedFeedback] = useState<string | null>(null);

    const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    const handleClick = (nodeType: NodeType, label: string) => {
        const offsetX = (nodes.length % 4) * 40;
        const offsetY = Math.floor(nodes.length / 4) * 40;
        addNode(nodeType, { x: 200 + offsetX, y: 120 + offsetY });
        setAddedFeedback(label);
        setTimeout(() => setAddedFeedback(null), 1000);
    };

    const toggleCategory = (name: string) => {
        setExpanded(prev => ({ ...prev, [name]: !prev[name] }));
    };

    return (
        <div className="p-3">
            <div className="text-[10px] text-[#555] uppercase tracking-wider mb-3">Nodes</div>

            {categories.map((cat) => (
                <div key={cat.name} className="mb-2">
                    <button
                        onClick={() => toggleCategory(cat.name)}
                        className="flex items-center gap-1 w-full text-[10px] text-[#777] uppercase tracking-wide py-1 hover:text-[#aaa] transition-colors"
                    >
                        {expanded[cat.name] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        {cat.name}
                    </button>

                    {expanded[cat.name] && (
                        <div className="space-y-1 mt-1">
                            {cat.items.map((item) => (
                                <div
                                    key={item.type}
                                    className="group cursor-pointer"
                                    draggable
                                    onDragStart={(e) => onDragStart(e, item.type)}
                                    onClick={() => handleClick(item.type, item.label)}
                                >
                                    <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#D4FF3F]/30 hover:bg-[#1f1f1f] transition-all group-active:scale-[0.98]">
                                        <div className={`w-5 h-5 rounded flex items-center justify-center bg-gradient-to-br ${item.gradient} text-white`}>
                                            {item.icon}
                                        </div>
                                        <span className="text-[11px] text-[#ccc] flex-1">{item.label}</span>
                                        <Plus className="w-3 h-3 text-[#444] group-hover:text-[#D4FF3F] opacity-0 group-hover:opacity-100 transition-all" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}

            {addedFeedback && (
                <div className="fixed bottom-3 left-3 bg-[#D4FF3F] text-black text-[10px] font-medium px-2 py-1 rounded shadow-lg z-50">
                    ✓ {addedFeedback}
                </div>
            )}
        </div>
    );
}
