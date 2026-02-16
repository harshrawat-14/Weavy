'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Zap, Save, Play, ArrowLeft, Download, Upload, Undo2, Redo2, PlayCircle } from 'lucide-react';
import { UserButton } from '@clerk/nextjs';

import WorkflowCanvas from '@/components/canvas/WorkflowCanvas';
import NodePalette from '@/components/canvas/NodePalette';
import HistorySidebar from '@/components/sidebar/HistorySidebar';
import { useWorkflowStore, WorkflowNode } from '@/lib/store';
import { validateDAG, getExecutionSubgraph } from '@/lib/dag';
import { Edge } from '@xyflow/react';

export default function WorkflowEditor() {
    const router = useRouter();
    const params = useParams();
    const workflowId = params?.id as string;
    const isNew = workflowId === 'new';

    const [isSaving, setIsSaving] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);

    const {
        workflowName, setWorkflowName, nodes, edges, selectedNodes,
        loadWorkflow, resetWorkflow, setWorkflowId, isExecuting,
        setIsExecuting, setCurrentRunId, setNodeExecutionStatus,
        clearExecutionStates, undo, redo, history, historyIndex,
        hydrateNodeOutputCache,
    } = useWorkflowStore();

    useEffect(() => {
        if (!isNew && workflowId) fetchWorkflow();
        else resetWorkflow();
    }, [workflowId, isNew]);

    const fetchWorkflow = async () => {
        try {
            const response = await fetch(`/api/workflows/${workflowId}`);
            if (response.ok) {
                const data = await response.json();
                loadWorkflow(data.nodes as WorkflowNode[], data.edges as Edge[], data.id, data.name);
                // Hydrate cache with persisted outputs
                setTimeout(() => hydrateNodeOutputCache(), 0);
            } else if (response.status === 404) {
                router.push('/dashboard');
            }
        } catch (error) {
            console.error('Failed to fetch workflow:', error);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSaveError(null);
        try {
            const method = isNew ? 'POST' : 'PUT';
            const url = isNew ? '/api/workflows' : `/api/workflows/${workflowId}`;
            console.log(`[WorkflowEditor] Saving workflow...`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: workflowName, nodes, edges }),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error('Failed to save');
            const data = await response.json();
            if (isNew) {
                setWorkflowId(data.id);
                router.replace(`/workflow/${data.id}`);
            }
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : 'Save failed');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRun = async () => {
        const validation = validateDAG(nodes, edges);
        if (!validation.valid) {
            alert(validation.error || 'Invalid workflow');
            return;
        }
        setIsRunning(true);
        setIsExecuting(true);
        clearExecutionStates();
        nodes.forEach(n => setNodeExecutionStatus(n.id, 'pending'));

        try {
            if (isNew) await handleSave();
            const response = await fetch('/api/runs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workflowId: isNew ? undefined : workflowId, nodes, edges, scope: 'full' }),
            });
            if (!response.ok) throw new Error('Execution failed');
            const data = await response.json();
            setCurrentRunId(data.runId);
            pollExecutionStatus(data.runId);
        } catch (error) {
            console.error('Execution failed:', error);
            setIsExecuting(false);
            setIsRunning(false);
        }
    };

    const handleRunSelected = async () => {
        if (selectedNodes.length === 0) return;
        setIsRunning(true);
        setIsExecuting(true);
        clearExecutionStates();
        // Only mark selected (and upstream) nodes as pending
        nodes.forEach(n => {
            if (selectedNodes.includes(n.id)) {
                setNodeExecutionStatus(n.id, 'pending');
            }
        });

        try {
            if (isNew) await handleSave();
            const response = await fetch('/api/runs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workflowId: isNew ? undefined : workflowId,
                    nodes, edges,
                    scope: 'PARTIAL',
                    selectedNodes,
                }),
            });
            if (!response.ok) throw new Error('Execution failed');
            const data = await response.json();
            setCurrentRunId(data.runId);
            pollExecutionStatus(data.runId);
        } catch (error) {
            console.error('Selective execution failed:', error);
            setIsExecuting(false);
            setIsRunning(false);
        }
    };

    const pollExecutionStatus = async (runId: string) => {
        const poll = async () => {
            try {
                const response = await fetch(`/api/runs/${runId}`);
                if (!response.ok) return;
                const data = await response.json();
                if (data.nodeLogs) {
                    data.nodeLogs.forEach((log: { nodeId: string; status: string; output?: unknown; error?: string }) => {
                        setNodeExecutionStatus(log.nodeId, log.status.toLowerCase() as any, log.output, log.error);
                    });
                }
                if (data.status === 'COMPLETED' || data.status === 'FAILED') {
                    setIsExecuting(false);
                    setIsRunning(false);
                    setCurrentRunId(null);
                    return;
                }
                setTimeout(poll, 1000);
            } catch (error) {
                setIsExecuting(false);
                setIsRunning(false);
            }
        };
        poll();
    };

    const handleExport = () => {
        const blob = new Blob([JSON.stringify({ name: workflowName, nodes, edges }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${workflowName.toLowerCase().replace(/\s+/g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                loadWorkflow(data.nodes, data.edges, '', data.name || 'Imported');
            } catch { alert('Import failed'); }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < history.length - 1;

    return (
        <div className="h-screen flex flex-col bg-[#0A0A0A]">
            {/* Header - 48px, pure black, compact */}
            <header className="h-12 flex items-center px-3 gap-3 bg-black border-b border-[#1a1a1a]">
                <Link href="/dashboard" className="p-1.5 rounded hover:bg-[#1a1a1a] transition-colors">
                    <ArrowLeft className="w-4 h-4 text-[#666]" />
                </Link>

                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                        <Zap className="w-3 h-3 text-white" />
                    </div>
                    <input
                        type="text"
                        value={workflowName}
                        onChange={(e) => setWorkflowName(e.target.value)}
                        onBlur={handleSave} // Auto-save on blur
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                        className="bg-transparent text-[13px] font-medium text-white focus:outline-none w-40 hover:bg-[#1a1a1a] focus:bg-[#1a1a1a] px-1.5 py-0.5 rounded transition-colors border border-transparent focus:border-[#333]"
                        placeholder="Untitled Workflow"
                    />
                </div>

                <div className="flex-1" />

                {/* Compact toolbar */}
                <div className="flex items-center gap-1">
                    <button onClick={undo} disabled={!canUndo || isExecuting} className="btn btn-ghost p-1.5" title="Undo">
                        <Undo2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={redo} disabled={!canRedo || isExecuting} className="btn btn-ghost p-1.5" title="Redo">
                        <Redo2 className="w-3.5 h-3.5" />
                    </button>

                    <div className="w-px h-4 bg-[#333] mx-1" />

                    <label className="btn btn-ghost p-1.5 cursor-pointer" title="Import">
                        <Upload className="w-3.5 h-3.5" />
                        <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                    </label>
                    <button onClick={handleExport} className="btn btn-ghost p-1.5" title="Export">
                        <Download className="w-3.5 h-3.5" />
                    </button>

                    <div className="w-px h-4 bg-[#333] mx-1" />

                    <button onClick={handleSave} disabled={isSaving || isExecuting} className="btn btn-secondary">
                        {isSaving ? <div className="spinner" /> : <Save className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline">Save</span>
                    </button>

                    {/* Run buttons removed in favor of per-node execution */}


                    <div className="w-px h-4 bg-[#333] mx-1" />

                    <UserButton appearance={{ elements: { avatarBox: 'w-6 h-6' } }} />
                </div>
            </header>

            {/* Main content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left sidebar - Node palette */}
                <aside className="w-52 border-r border-[#1a1a1a] bg-[#0d0d0d] overflow-auto">
                    <NodePalette />
                </aside>

                {/* Canvas */}
                <main className="flex-1 relative bg-[#0A0A0A]">
                    <WorkflowCanvas />
                </main>

                {/* Right sidebar - History (toggle) */}
                {showHistory && (
                    <aside className="w-64 border-l border-[#1a1a1a] bg-[#0d0d0d] overflow-hidden">
                        <HistorySidebar workflowId={isNew ? null : workflowId} />
                    </aside>
                )}
            </div>

            {/* Error toast */}
            {saveError && (
                <div className="fixed bottom-4 right-4 bg-red-500/90 text-white text-[11px] px-3 py-2 rounded shadow-lg">
                    {saveError}
                    <button onClick={() => setSaveError(null)} className="ml-2 opacity-70 hover:opacity-100">✕</button>
                </div>
            )}
        </div>
    );
}
