'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GitBranch, Clock, Zap, Trash2 } from 'lucide-react';

interface WorkflowCardProps {
    workflow: {
        id: string;
        name: string;
        description: string | null;
        updatedAt: Date;
        _count: { runs: number };
    };
}

export default function WorkflowCard({ workflow }: WorkflowCardProps) {
    const router = useRouter();
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!confirm(`Delete "${workflow.name}"? This cannot be undone.`)) {
            return;
        }

        setIsDeleting(true);
        try {
            const response = await fetch(`/api/workflows/${workflow.id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                router.refresh();
            } else {
                alert('Failed to delete workflow');
                setIsDeleting(false);
            }
        } catch (error) {
            console.error('Delete failed:', error);
            alert('Failed to delete workflow');
            setIsDeleting(false);
        }
    };

    return (
        <div className="relative group">
            <Link
                href={`/workflow/${workflow.id}`}
                className="card block hover:border-indigo-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10"
            >
                <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                        <GitBranch className="w-6 h-6" />
                    </div>
                </div>
                <h3 className="text-lg font-semibold mb-1 group-hover:text-indigo-400 transition-colors">
                    {workflow.name}
                </h3>
                <p className="text-slate-400 text-sm mb-4 line-clamp-2">
                    {workflow.description || 'No description'}
                </p>
                <div className="flex items-center gap-4 text-sm text-slate-500">
                    <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {new Date(workflow.updatedAt).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1">
                        <Zap className="w-4 h-4" />
                        {workflow._count.runs} runs
                    </div>
                </div>
            </Link>

            {/* Delete button - shows on hover */}
            <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="absolute top-3 right-3 p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                title="Delete workflow"
            >
                <Trash2 className="w-4 h-4 text-red-400" />
            </button>
        </div>
    );
}
