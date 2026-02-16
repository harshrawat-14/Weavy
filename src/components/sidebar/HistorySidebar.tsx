'use client';

import { useEffect, useState } from 'react';
import { Clock, CheckCircle, XCircle, Loader2, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { useWorkflowStore } from '@/lib/store';

interface NodeLogData {
    id: string;
    nodeId: string;
    nodeType: string;
    status: string;
    duration?: number;
    output?: unknown;
    error?: string;
}

interface RunData {
    id: string;
    status: string;
    scope: string;
    duration?: number;
    startedAt: string;
    completedAt?: string;
    nodeLogs: NodeLogData[];
}

interface HistorySidebarProps {
    workflowId: string | null;
}

export default function HistorySidebar({ workflowId }: HistorySidebarProps) {
    const [runs, setRuns] = useState<RunData[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedRun, setExpandedRun] = useState<string | null>(null);
    const currentRunId = useWorkflowStore((state) => state.currentRunId);

    const fetchRuns = async () => {
        if (!workflowId) return;

        setLoading(true);
        try {
            const response = await fetch(`/api/runs?workflowId=${workflowId}`);
            if (response.ok) {
                const data = await response.json();
                setRuns(data.runs || []);
            }
        } catch (error) {
            console.error('Failed to fetch runs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRuns();
    }, [workflowId, currentRunId]);

    // Poll for updates when there's a running execution
    useEffect(() => {
        if (!currentRunId || !workflowId) return;

        const interval = setInterval(fetchRuns, 2000);
        return () => clearInterval(interval);
    }, [currentRunId, workflowId]);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'RUNNING':
                return <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />;
            case 'COMPLETED':
                return <CheckCircle className="w-4 h-4 text-green-400" />;
            case 'FAILED':
                return <XCircle className="w-4 h-4 text-red-400" />;
            default:
                return <Clock className="w-4 h-4 text-slate-400" />;
        }
    };

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'RUNNING':
                return 'badge-info';
            case 'COMPLETED':
                return 'badge-success';
            case 'FAILED':
                return 'badge-danger';
            default:
                return '';
        }
    };

    const formatDuration = (ms?: number) => {
        if (!ms) return '-';
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                    Run History
                </h3>
                <button
                    onClick={fetchRuns}
                    className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                    disabled={loading}
                >
                    <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="flex-1 overflow-auto p-2">
                {!workflowId ? (
                    <div className="text-center text-slate-500 text-sm py-8">
                        Save workflow to view history
                    </div>
                ) : runs.length === 0 ? (
                    <div className="text-center text-slate-500 text-sm py-8">
                        No runs yet
                    </div>
                ) : (
                    <div className="space-y-2">
                        {runs.map((run) => (
                            <div
                                key={run.id}
                                className="rounded-lg bg-slate-800/50 border border-slate-700/50 overflow-hidden"
                            >
                                {/* Run header */}
                                <button
                                    className="w-full p-3 flex items-center gap-3 hover:bg-slate-800/80 transition-colors"
                                    onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                                >
                                    {expandedRun === run.id ? (
                                        <ChevronDown className="w-4 h-4 text-slate-400" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4 text-slate-400" />
                                    )}

                                    {getStatusIcon(run.status)}

                                    <div className="flex-1 text-left">
                                        <div className="text-sm font-medium text-slate-200">
                                            {formatTime(run.startedAt)}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className={`badge ${getStatusBadgeClass(run.status)}`}>
                                                {run.status.toLowerCase()}
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                {run.scope.toLowerCase()}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="text-xs text-slate-500">
                                        {formatDuration(run.duration)}
                                    </div>
                                </button>

                                {/* Expanded node logs */}
                                {expandedRun === run.id && run.nodeLogs && (
                                    <div className="border-t border-slate-700/50 p-2 space-y-1">
                                        {run.nodeLogs.map((log) => (
                                            <div
                                                key={log.id}
                                                className="p-2 rounded bg-slate-900/50 text-xs"
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-slate-300 font-medium">
                                                        {log.nodeType}
                                                    </span>
                                                    <span className={`badge ${getStatusBadgeClass(log.status)}`}>
                                                        {log.status.toLowerCase()}
                                                    </span>
                                                </div>

                                                {log.duration && (
                                                    <div className="text-slate-500">
                                                        Duration: {formatDuration(log.duration)}
                                                    </div>
                                                )}

                                                {log.error && (
                                                    <div className="mt-1 p-1.5 rounded bg-red-900/20 text-red-400 break-all">
                                                        {log.error}
                                                    </div>
                                                )}

                                                {log.output !== undefined && log.output !== null && (
                                                    <div className="mt-1 p-1.5 rounded bg-slate-800 text-slate-300 break-all max-h-20 overflow-auto">
                                                        {typeof log.output === 'string'
                                                            ? (log.output.length > 200 ? log.output.slice(0, 200) + '...' : log.output)
                                                            : JSON.stringify(log.output).slice(0, 200)}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
