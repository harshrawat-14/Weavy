'use client';

import { useCallback } from 'react';
import { useWorkflowStore } from './store';
import { validateDAG, getExecutionSubgraph } from './dag';

/**
 * Hook for per-node execution.
 * Triggers a run for a specific node + its upstream dependencies,
 * polls status, and populates nodeOutputCache on completion.
 */
export function useNodeExecution() {
    const {
        nodes, edges, workflowId,
        setIsExecuting, setCurrentRunId,
        setNodeExecutionStatus, clearExecutionStates,
        setNodeOutputCache,
    } = useWorkflowStore();

    const runNode = useCallback(async (nodeId: string) => {
        const validation = validateDAG(nodes, edges);
        if (!validation.valid) {
            console.error(validation.error || 'Invalid workflow');
            return;
        }

        // Get subgraph: this node + upstream deps
        const subgraph = getExecutionSubgraph([nodeId], nodes, edges);

        setIsExecuting(true);

        // Mark subgraph nodes as pending
        subgraph.nodes.forEach(n => setNodeExecutionStatus(n.id, 'pending'));

        try {
            const response = await fetch('/api/runs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workflowId: workflowId || undefined,
                    nodes, edges,
                    scope: 'PARTIAL',
                    selectedNodes: [nodeId],
                }),
            });

            if (!response.ok) throw new Error('Execution failed');
            const data = await response.json();
            setCurrentRunId(data.runId);
            pollStatus(data.runId);
        } catch (error) {
            console.error('Node execution failed:', error);
            setIsExecuting(false);
        }
    }, [nodes, edges, workflowId, setIsExecuting, setCurrentRunId, setNodeExecutionStatus]);

    const pollStatus = useCallback(async (runId: string) => {
        const poll = async () => {
            try {
                const response = await fetch(`/api/runs/${runId}`);
                if (!response.ok) return;
                const data = await response.json();

                if (data.nodeLogs) {
                    console.log(`[Poll ${runId}] Received ${data.nodeLogs.length} logs. Workflow Status: ${data.status}`);

                    data.nodeLogs.forEach((log: { nodeId: string; status: string; output?: string; error?: string }) => {
                        const status = log.status.toLowerCase() as 'pending' | 'running' | 'success' | 'failed';
                        console.log(`[Node ${log.nodeId}] Update: ${status.toUpperCase()} ${log.output ? `(Output: ${log.output.length} chars)` : ''}`);

                        // Check if we should persist this output (e.g. skip large images/frames to avoid DB bloat)
                        // For now, we'll optimistically skip persistence if it looks like a data URL or if it's an ExtractFrame node
                        // Since we don't have the node type here easily without lookup, let's just default to TRUE for logic safety 
                        // unless we specifically know it's heavy.
                        // Actually, getting the node from store is cheap.
                        const node = useWorkflowStore.getState().nodes.find(n => n.id === log.nodeId);
                        const isExtractFrame = node?.type === 'EXTRACT_FRAME';

                        // Don't persist output for Extract Frame (it's heavy and ephemeral-ish)
                        const shouldPersist = !isExtractFrame;

                        setNodeExecutionStatus(log.nodeId, status, log.output, log.error, shouldPersist);

                        // Cache successful outputs for downstream processing nodes
                        if (status === 'success' && log.output && typeof log.output === 'string') {
                            console.log(`[Cache] Updating output for node ${log.nodeId}: ${log.output.slice(0, 50)}...`);
                            setNodeOutputCache(log.nodeId, log.output);
                        }
                    });
                }

                if (data.status === 'COMPLETED' || data.status === 'FAILED') {
                    setIsExecuting(false);
                    setCurrentRunId(null);
                    return;
                }
                setTimeout(poll, 1000);
            } catch {
                setIsExecuting(false);
            }
        };
        poll();
    }, [setNodeExecutionStatus, setNodeOutputCache, setIsExecuting, setCurrentRunId]);

    return { runNode };
}
