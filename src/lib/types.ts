import { z } from 'zod';

// ============ Node Types ============

export const NodeTypes = {
    TEXT: 'textNode',
    IMAGE_UPLOAD: 'imageUploadNode',
    CROP_IMAGE: 'cropImageNode',
    VIDEO_UPLOAD: 'videoUploadNode',
    EXTRACT_FRAME: 'extractFrameNode',
    LLM: 'llmNode',
} as const;

export type NodeType = typeof NodeTypes[keyof typeof NodeTypes];

// ============ Node Data Schemas ============

export const TextNodeDataSchema = z.object({
    type: z.literal(NodeTypes.TEXT),
    systemPrompt: z.string().optional().default(''),
    userMessage: z.string().default(''),
    output: z.string().optional(),
    attachments: z.array(z.object({
        url: z.string(),
        name: z.string(),
        type: z.enum(['image', 'pdf']),
    })).optional().default([]),
    executionStatus: z.enum(['idle', 'pending', 'running', 'success', 'failed', 'skipped']).optional(),
    executionOutput: z.unknown().optional(),
    executionError: z.string().optional(),
});

export const ImageUploadNodeDataSchema = z.object({
    type: z.literal(NodeTypes.IMAGE_UPLOAD),
    imageUrl: z.string().optional(),
    fileName: z.string().optional(),
    output: z.string().optional(),
    executionStatus: z.enum(['idle', 'pending', 'running', 'success', 'failed', 'skipped']).optional(),
    executionOutput: z.unknown().optional(),
    executionError: z.string().optional(),
});

export const CropImageNodeDataSchema = z.object({
    type: z.literal(NodeTypes.CROP_IMAGE),
    imageUrl: z.string().optional(),
    xPercent: z.number().min(0).max(100).default(0),
    yPercent: z.number().min(0).max(100).default(0),
    widthPercent: z.number().min(0).max(100).default(100),
    heightPercent: z.number().min(0).max(100).default(100),
    output: z.string().optional(),
    executionStatus: z.enum(['idle', 'pending', 'running', 'success', 'failed', 'skipped']).optional(),
    executionOutput: z.unknown().optional(),
    executionError: z.string().optional(),
});

export const VideoUploadNodeDataSchema = z.object({
    type: z.literal(NodeTypes.VIDEO_UPLOAD),
    videoUrl: z.string().optional(),
    fileName: z.string().optional(),
    output: z.string().optional(),
    executionStatus: z.enum(['idle', 'pending', 'running', 'success', 'failed', 'skipped']).optional(),
    executionOutput: z.unknown().optional(),
    executionError: z.string().optional(),
});

export const ExtractFrameNodeDataSchema = z.object({
    type: z.literal(NodeTypes.EXTRACT_FRAME),
    videoUrl: z.string().optional(),
    timestamp: z.string().default('50%'),
    output: z.string().optional(),
    executionStatus: z.enum(['idle', 'pending', 'running', 'success', 'failed', 'skipped']).optional(),
    executionOutput: z.unknown().optional(),
    executionError: z.string().optional(),
});

export const LLMNodeDataSchema = z.object({
    type: z.literal(NodeTypes.LLM),
    systemPrompt: z.string().optional().default(''),
    textInputs: z.array(z.string()).optional().default([]),
    imageUrls: z.array(z.string()).optional().default([]),
    output: z.string().optional(),
    executionStatus: z.enum(['idle', 'pending', 'running', 'success', 'failed', 'skipped']).optional(),
    executionOutput: z.unknown().optional(),
    executionError: z.string().optional(),
});

export type TextNodeData = z.infer<typeof TextNodeDataSchema>;
export type ImageUploadNodeData = z.infer<typeof ImageUploadNodeDataSchema>;
export type CropImageNodeData = z.infer<typeof CropImageNodeDataSchema>;
export type VideoUploadNodeData = z.infer<typeof VideoUploadNodeDataSchema>;
export type ExtractFrameNodeData = z.infer<typeof ExtractFrameNodeDataSchema>;
export type LLMNodeData = z.infer<typeof LLMNodeDataSchema>;

export type NodeData =
    | TextNodeData
    | ImageUploadNodeData
    | CropImageNodeData
    | VideoUploadNodeData
    | ExtractFrameNodeData
    | LLMNodeData;

// ============ Workflow Schemas ============

export const WorkflowNodeSchema = z.object({
    id: z.string(),
    type: z.string(),
    position: z.object({
        x: z.number(),
        y: z.number(),
    }),
    data: z.record(z.string(), z.unknown()),
});

export const WorkflowEdgeSchema = z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    sourceHandle: z.string().optional(),
    targetHandle: z.string().optional(),
});

export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;
export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;

// ============ Execution Types ============

export type NodeExecutionStatus = 'idle' | 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface NodeExecutionState {
    nodeId: string;
    status: NodeExecutionStatus;
    output?: unknown;
    error?: string;
    startedAt?: Date;
    completedAt?: Date;
    duration?: number;
}

export interface RunState {
    runId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    scope: 'single' | 'partial' | 'full';
    selectedNodes: string[];
    nodeStates: Map<string, NodeExecutionState>;
    startedAt?: Date;
    completedAt?: Date;
    duration?: number;
}

// ============ Output Types ============

export interface NodeOutputType {
    [NodeTypes.TEXT]: 'text';
    [NodeTypes.IMAGE_UPLOAD]: 'image_url';
    [NodeTypes.CROP_IMAGE]: 'image_url';
    [NodeTypes.VIDEO_UPLOAD]: 'video_url';
    [NodeTypes.EXTRACT_FRAME]: 'image_url';
    [NodeTypes.LLM]: 'text';
}

export const getNodeOutputTypes = (nodeType: NodeType): Array<'text' | 'image_url' | 'video_url'> => {
    switch (nodeType) {
        case NodeTypes.TEXT:
            return ['text'];
        case NodeTypes.LLM:
            return ['text', 'image_url']; // LLM can generate text or images
        case NodeTypes.IMAGE_UPLOAD:
        case NodeTypes.CROP_IMAGE:
        case NodeTypes.EXTRACT_FRAME:
            return ['image_url'];
        case NodeTypes.VIDEO_UPLOAD:
            return ['video_url'];
        default:
            return ['text'];
    }
};

// ============ Connection Validation ============

export const getNodeInputTypes = (nodeType: NodeType): Array<'text' | 'image_url' | 'video_url'> => {
    switch (nodeType) {
        case NodeTypes.TEXT:
            return [];
        case NodeTypes.IMAGE_UPLOAD:
            return [];
        case NodeTypes.CROP_IMAGE:
            return ['image_url'];
        case NodeTypes.VIDEO_UPLOAD:
            return [];
        case NodeTypes.EXTRACT_FRAME:
            return ['video_url'];
        case NodeTypes.LLM:
            return ['text', 'image_url'];
        default:
            return [];
    }
};

export const canConnect = (sourceType: NodeType, targetType: NodeType): boolean => {
    const outputTypes = getNodeOutputTypes(sourceType);
    const acceptedInputs = getNodeInputTypes(targetType);
    return outputTypes.some(ot => acceptedInputs.includes(ot));
};
