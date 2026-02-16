import { create } from 'zustand';
import {
    Node,
    Edge,
    Connection,
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
    NodeChange,
    EdgeChange,
} from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import { NodeTypes, NodeData, canConnect, NodeType } from './types';
import { validateDAG, getParentNodes } from './dag';

export type NodeExecutionStatus = 'idle' | 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface WorkflowNode extends Node {
    data: NodeData & {
        label?: string;
        executionStatus?: NodeExecutionStatus;
        executionOutput?: unknown;
        executionError?: string;
    };
}

interface HistoryState {
    nodes: WorkflowNode[];
    edges: Edge[];
}

interface WorkflowState {
    // Workflow metadata
    workflowId: string | null;
    workflowName: string;

    // Nodes and edges
    nodes: WorkflowNode[];
    edges: Edge[];

    // Selection
    selectedNodes: string[];

    // Execution state
    isExecuting: boolean;
    currentRunId: string | null;

    // Node output cache (for reactive processing nodes)
    nodeOutputCache: Record<string, string>;

    // History for undo/redo
    history: HistoryState[];
    historyIndex: number;

    // Actions
    setWorkflowId: (id: string | null) => void;
    setWorkflowName: (name: string) => void;
    setNodes: (nodes: WorkflowNode[]) => void;
    setEdges: (edges: Edge[]) => void;
    onNodesChange: (changes: NodeChange[]) => void;
    onEdgesChange: (changes: EdgeChange[]) => void;
    onConnect: (connection: Connection) => void;
    addNode: (type: NodeType, position: { x: number; y: number }) => void;
    updateNodeData: (nodeId: string, data: Partial<NodeData>) => void;
    deleteNode: (nodeId: string) => void;
    deleteEdge: (edgeId: string) => void;
    selectNodes: (nodeIds: string[]) => void;
    clearSelection: () => void;
    setNodeExecutionStatus: (nodeId: string, status: NodeExecutionStatus, output?: unknown, error?: string, persistOutput?: boolean) => void;
    clearExecutionStates: () => void;
    setIsExecuting: (isExecuting: boolean) => void;
    setCurrentRunId: (runId: string | null) => void;
    setNodeOutputCache: (nodeId: string, output: string) => void;
    getUpstreamOutput: (nodeId: string, handleId?: string) => string | null;
    clearNodeOutputCache: () => void;
    hydrateNodeOutputCache: () => void;
    undo: () => void;
    redo: () => void;
    pushHistory: () => void;
    loadWorkflow: (nodes: WorkflowNode[], edges: Edge[], id: string, name: string) => void;
    resetWorkflow: () => void;
}

const getDefaultNodeData = (type: NodeType): NodeData => {
    switch (type) {
        case NodeTypes.TEXT:
            return { type: NodeTypes.TEXT, systemPrompt: '', userMessage: '', attachments: [] };
        case NodeTypes.IMAGE_UPLOAD:
            return { type: NodeTypes.IMAGE_UPLOAD };
        case NodeTypes.CROP_IMAGE:
            return { type: NodeTypes.CROP_IMAGE, xPercent: 0, yPercent: 0, widthPercent: 100, heightPercent: 100 };
        case NodeTypes.VIDEO_UPLOAD:
            return { type: NodeTypes.VIDEO_UPLOAD };
        case NodeTypes.EXTRACT_FRAME:
            return { type: NodeTypes.EXTRACT_FRAME, timestamp: '50%' };
        case NodeTypes.LLM:
            return { type: NodeTypes.LLM, systemPrompt: '', textInputs: [], imageUrls: [] };
        default:
            return { type: NodeTypes.TEXT, systemPrompt: '', userMessage: '', attachments: [] };
    }
};

const getNodeLabel = (type: NodeType): string => {
    switch (type) {
        case NodeTypes.TEXT:
            return 'Text Input';
        case NodeTypes.IMAGE_UPLOAD:
            return 'Upload Image';
        case NodeTypes.CROP_IMAGE:
            return 'Crop Image';
        case NodeTypes.VIDEO_UPLOAD:
            return 'Upload Video';
        case NodeTypes.EXTRACT_FRAME:
            return 'Extract Frame';
        case NodeTypes.LLM:
            return 'LLM (Groq AI)';
        default:
            return 'Node';
    }
};

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
    workflowId: null,
    workflowName: 'Untitled Workflow',
    nodes: [],
    edges: [],
    selectedNodes: [],
    isExecuting: false,
    currentRunId: null,
    nodeOutputCache: {},
    history: [],
    historyIndex: -1,

    setWorkflowId: (id) => set({ workflowId: id }),

    setWorkflowName: (name) => set({ workflowName: name }),

    setNodes: (nodes) => set({ nodes }),

    setEdges: (edges) => set({ edges }),

    onNodesChange: (changes) => {
        set((state) => ({
            nodes: applyNodeChanges(changes, state.nodes) as WorkflowNode[],
        }));
    },

    onEdgesChange: (changes) => {
        set((state) => ({
            edges: applyEdgeChanges(changes, state.edges),
        }));
    },

    onConnect: (connection) => {
        const { nodes, edges, pushHistory } = get();

        // Find source and target nodes
        const sourceNode = nodes.find(n => n.id === connection.source);
        const targetNode = nodes.find(n => n.id === connection.target);

        if (!sourceNode || !targetNode) return;

        // Type-safe connection validation
        const sourceType = sourceNode.data.type as NodeType;
        const targetType = targetNode.data.type as NodeType;

        if (!canConnect(sourceType, targetType)) {
            console.warn('Invalid connection: types are incompatible');
            return;
        }

        // Check if adding this edge would create a cycle
        const newEdges = addEdge({
            ...connection,
            animated: true,
            style: { strokeWidth: 2, stroke: '#6366f1' },
        }, edges);

        const validation = validateDAG(nodes, newEdges);
        if (!validation.valid) {
            console.warn('Invalid connection: would create a cycle');
            return;
        }

        pushHistory();
        set({ edges: newEdges });
    },

    addNode: (type, position) => {
        const { pushHistory } = get();
        pushHistory();

        const newNode: WorkflowNode = {
            id: uuidv4(),
            type,
            position,
            data: {
                ...getDefaultNodeData(type),
                label: getNodeLabel(type),
                executionStatus: 'idle',
            },
        };

        set((state) => ({
            nodes: [...state.nodes, newNode],
        }));
    },

    updateNodeData: (nodeId, data) => {
        set((state) => ({
            nodes: state.nodes.map((node) =>
                node.id === nodeId
                    ? { ...node, data: { ...node.data, ...data } } as WorkflowNode
                    : node
            ),
        }));
    },

    deleteNode: (nodeId) => {
        const { pushHistory } = get();
        pushHistory();

        set((state) => ({
            nodes: state.nodes.filter((node) => node.id !== nodeId),
            edges: state.edges.filter(
                (edge) => edge.source !== nodeId && edge.target !== nodeId
            ),
            selectedNodes: state.selectedNodes.filter((id) => id !== nodeId),
        }));
    },

    deleteEdge: (edgeId) => {
        const { pushHistory } = get();
        pushHistory();

        set((state) => ({
            edges: state.edges.filter((edge) => edge.id !== edgeId),
        }));
    },

    selectNodes: (nodeIds) => set({ selectedNodes: nodeIds }),

    clearSelection: () => set({ selectedNodes: [] }),

    setNodeExecutionStatus: (nodeId, status, output, error, persistOutput = true) => {
        set((state) => ({
            nodes: state.nodes.map((node) =>
                node.id === nodeId
                    ? {
                        ...node,
                        data: {
                            ...node.data,
                            executionStatus: status,
                            // Only update executionOutput if persistOutput is true, or if it's undefined (clearing)
                            ...(persistOutput || output === undefined ? { executionOutput: output } : {}),
                            executionError: error,
                        },
                    } as WorkflowNode
                    : node
            ),
        }));
    },

    clearExecutionStates: () => {
        set((state) => ({
            nodes: state.nodes.map((node) => ({
                ...node,
                data: {
                    ...node.data,
                    executionStatus: 'idle' as NodeExecutionStatus,
                    executionOutput: undefined,
                    executionError: undefined,
                },
            } as WorkflowNode)),
        }));
    },

    setIsExecuting: (isExecuting) => set({ isExecuting }),

    setCurrentRunId: (runId) => set({ currentRunId: runId }),

    setNodeOutputCache: (nodeId, output) => {
        console.debug(`[Store] Updates cache for node ${nodeId} (${output.length} chars)`);
        set((state) => ({
            nodeOutputCache: { ...state.nodeOutputCache, [nodeId]: output },
        }));
    },

    getUpstreamOutput: (nodeId, handleId) => {
        const { nodes, edges, nodeOutputCache } = get();

        // Find edges connected to this node's inputs
        const incomingEdges = edges.filter(e => e.target === nodeId);

        // If handleId is specified, filter by it
        // (Not strictly necessary if node only has one input, but good for robustness)
        // For now, simpliest approach: check all incoming edges' source nodes

        for (const edge of incomingEdges) {
            // If handleId is provided, ensure this edge connects to it
            if (handleId && edge.targetHandle !== handleId) continue;

            const sourceNodeId = edge.source;
            const output = nodeOutputCache[sourceNodeId];

            if (output) {
                return output;
            }

            // Note: We deliberately do NOT fallback to persistient data (sourceNode.data.executionOutput) here.
            // Reactivity relies strictly on the cache. Hydration should have populated cache if data existed on load.
        }

        return null;
    },

    hydrateNodeOutputCache: () => {
        const { nodes } = get();
        const cacheUpdate: Record<string, string> = {};

        nodes.forEach(node => {
            if (node.data.executionStatus === 'success' && node.data.executionOutput && typeof node.data.executionOutput === 'string') {
                cacheUpdate[node.id] = node.data.executionOutput;
            }
            // Auto-hydrate video upload nodes too
            if (node.type === NodeTypes.VIDEO_UPLOAD) {
                const videoUrl = (node.data as any).videoUrl;
                if (videoUrl && typeof videoUrl === 'string') {
                    cacheUpdate[node.id] = videoUrl;
                }
            }
        });

        const count = Object.keys(cacheUpdate).length;
        if (count > 0) {
            console.log(`[Store] Hydrated cache with ${count} items from persistence`);
        }

        set((state) => ({
            nodeOutputCache: { ...state.nodeOutputCache, ...cacheUpdate }
        }));
    },

    clearNodeOutputCache: () => set({ nodeOutputCache: {} }),

    undo: () => {
        const { history, historyIndex } = get();
        if (historyIndex > 0) {
            const prevState = history[historyIndex - 1];
            set({
                nodes: prevState.nodes,
                edges: prevState.edges,
                historyIndex: historyIndex - 1,
            });
        }
    },

    redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex < history.length - 1) {
            const nextState = history[historyIndex + 1];
            set({
                nodes: nextState.nodes,
                edges: nextState.edges,
                historyIndex: historyIndex + 1,
            });
        }
    },

    pushHistory: () => {
        const { nodes, edges, history, historyIndex } = get();
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push({ nodes: [...nodes], edges: [...edges] });

        // Keep only last 50 states
        if (newHistory.length > 50) {
            newHistory.shift();
        }

        set({
            history: newHistory,
            historyIndex: newHistory.length - 1,
        });
    },

    loadWorkflow: (nodes, edges, id, name) => {
        set({
            nodes,
            edges,
            workflowId: id,
            workflowName: name,
            selectedNodes: [],
            history: [{ nodes, edges }],
            historyIndex: 0,
        });
        // Hydrate cache immediately after loading
        get().hydrateNodeOutputCache();
    },

    resetWorkflow: () => {
        set({
            workflowId: null,
            workflowName: 'Untitled Workflow',
            nodes: [],
            edges: [],
            selectedNodes: [],
            isExecuting: false,
            currentRunId: null,
            nodeOutputCache: {},
            history: [],
            historyIndex: -1,
        });
    },
}));
