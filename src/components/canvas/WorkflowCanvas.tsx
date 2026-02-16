'use client';

import { useCallback, useRef, useEffect } from 'react';
import {
    ReactFlow,
    Controls,
    Background,
    BackgroundVariant,
    Connection,
    Edge,
    SelectionMode,
    useReactFlow,
    ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useWorkflowStore, WorkflowNode } from '@/lib/store';
import { NodeTypes as NodeTypeConstants, canConnect, NodeType } from '@/lib/types';
import {
    TextNode,
    ImageUploadNode,
    CropImageNode,
    VideoUploadNode,
    ExtractFrameNode,
    LLMNode,
} from '@/components/nodes';

const nodeTypes = {
    [NodeTypeConstants.TEXT]: TextNode,
    [NodeTypeConstants.IMAGE_UPLOAD]: ImageUploadNode,
    [NodeTypeConstants.CROP_IMAGE]: CropImageNode,
    [NodeTypeConstants.VIDEO_UPLOAD]: VideoUploadNode,
    [NodeTypeConstants.EXTRACT_FRAME]: ExtractFrameNode,
    [NodeTypeConstants.LLM]: LLMNode,
};

function WorkflowCanvasInner() {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const { screenToFlowPosition } = useReactFlow();

    const {
        nodes, edges, onNodesChange, onEdgesChange, onConnect,
        addNode, deleteNode, deleteEdge, selectNodes, selectedNodes,
        undo, redo, pushHistory,
    } = useWorkflowStore();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
                e.preventDefault();
                redo();
            }
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodes.length > 0) {
                if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
                e.preventDefault();
                selectedNodes.forEach((nodeId) => deleteNode(nodeId));
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo, deleteNode, selectedNodes]);

    const isValidConnection = useCallback(
        (edgeOrConnection: Edge | Connection) => {
            const sourceNode = nodes.find((n) => n.id === edgeOrConnection.source);
            const targetNode = nodes.find((n) => n.id === edgeOrConnection.target);
            if (!sourceNode || !targetNode) return false;
            return canConnect(sourceNode.data.type as NodeType, targetNode.data.type as NodeType);
        },
        [nodes]
    );

    const onSelectionChange = useCallback(
        ({ nodes: selectedFlowNodes }: { nodes: WorkflowNode[] }) => {
            selectNodes(selectedFlowNodes.map((n) => n.id));
        },
        [selectNodes]
    );

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();
            const type = event.dataTransfer.getData('application/reactflow') as NodeType;
            if (!type) return;
            const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
            addNode(type, position);
        },
        [screenToFlowPosition, addNode]
    );

    const onEdgeDoubleClick = useCallback((_event: React.MouseEvent, edge: { id: string }) => {
        deleteEdge(edge.id);
    }, [deleteEdge]);

    return (
        <div ref={reactFlowWrapper} className="w-full h-full bg-[#0A0A0A]">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                isValidConnection={isValidConnection}
                onSelectionChange={onSelectionChange}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onEdgeDoubleClick={onEdgeDoubleClick}
                onNodeDragStop={() => pushHistory()}
                fitView
                deleteKeyCode={null}
                selectionMode={SelectionMode.Partial}
                panOnScroll
                zoomOnScroll
                minZoom={0.1}
                maxZoom={2}
                defaultEdgeOptions={{
                    animated: true,
                    style: { strokeWidth: 1.5, stroke: '#D4FF3F' },
                }}
                proOptions={{ hideAttribution: true }}
            >
                <Controls position="bottom-left" showInteractive={false} />
                <Background variant={BackgroundVariant.Dots} gap={20} size={0.5} color="#1a1a1a" />
            </ReactFlow>
        </div>
    );
}

export default function WorkflowCanvas() {
    return (
        <ReactFlowProvider>
            <WorkflowCanvasInner />
        </ReactFlowProvider>
    );
}
