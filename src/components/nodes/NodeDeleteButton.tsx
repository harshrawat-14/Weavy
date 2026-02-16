'use client';

import { X } from 'lucide-react';
import { useWorkflowStore } from '@/lib/store';

interface NodeDeleteButtonProps {
    nodeId: string;
}

export default function NodeDeleteButton({ nodeId }: NodeDeleteButtonProps) {
    const deleteNode = useWorkflowStore((state) => state.deleteNode);
    const isExecuting = useWorkflowStore((state) => state.isExecuting);

    if (isExecuting) return null;

    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                // Simple direct deletion for speed/snappiness
                deleteNode(nodeId);
            }}
            className="
                absolute -top-3 -right-3 w-6 h-6 rounded-full 
                bg-[#1a1a1a] border border-[#333] hover:border-red-500/50 hover:bg-red-500/10 
                flex items-center justify-center 
                opacity-0 group-hover:opacity-100 
                scale-90 group-hover:scale-100
                transition-all duration-200 z-50 
                hover:shadow-lg
                cursor-pointer
            "
            title="Delete node"
        >
            <X className="w-3 h-3 text-[#666] group-hover:text-red-400 transition-colors" />
        </button>
    );
}
