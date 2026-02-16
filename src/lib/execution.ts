import { tasks } from '@trigger.dev/sdk/v3';
import Groq from 'groq-sdk';
import { HfInference } from '@huggingface/inference';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { uploadToCloudinary, getVideoFrameUrl } from './cloudinary';
import prisma from './db';



// Robust FFmpeg path resolution
let ffmpegPath = ffmpegStatic;
if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
    const platform = os.platform();
    const ffmpegName = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    const potentialPath = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', ffmpegName);
    if (fs.existsSync(potentialPath)) {
        ffmpegPath = potentialPath;
    } else {
        console.warn(`FFmpeg binary not found at ${potentialPath} nor via import`);
    }
}

// Configure fluent-ffmpeg to use the resolved binaries
if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
    // We don't need ffprobe path anymore as we use ffmpeg for probing
}

// ... (skipping unchanged parts) ...

/**
 * Helper: Get Video Duration using ffmpeg (avoiding broken ffprobe-static binaries)
 */
function getVideoDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
        if (!ffmpegPath) return reject(new Error('FFmpeg binary not found'));

        // Run ffmpeg with -i to get metadata (it outputs to stderr)
        const args = ['-i', filePath];
        const child = spawn(ffmpegPath, args);

        let stderr = '';
        child.stderr.on('data', d => stderr += d.toString());

        child.on('close', () => {
            // ffmpeg exits with 1 when no output file is specified, which is expected here.
            // We just need to parse stderr.

            // Regex to match "Duration: HH:MM:SS.ms,"
            const match = stderr.match(/Duration:\s+(\d{2}):(\d{2}):(\d{2}\.\d+)/);
            if (match) {
                const hours = parseFloat(match[1]);
                const minutes = parseFloat(match[2]);
                const seconds = parseFloat(match[3]);
                const duration = (hours * 3600) + (minutes * 60) + seconds;
                if (!isNaN(duration)) {
                    return resolve(duration);
                }
            }

            // If regex fails, try to see if it's because of some other error
            if (stderr.includes('Invalid data found')) {
                return reject(new Error('Invalid video file'));
            }

            // Fallback or error
            console.warn('Could not parse duration from ffmpeg output:', stderr);
            resolve(0); // Default to 0 or throw? 
            // Better to throw if we can't get duration for percentage seek
            // But let's reject to be safe
            reject(new Error('Could not parse video duration'));
        });

        child.on('error', err => reject(err));
    });
}

interface WorkflowNode {
    id: string;
    type: string;
    data: Record<string, unknown>;
}

interface WorkflowEdge {
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
}

interface ExecutionContext {
    runId: string;
    outputs: Map<string, unknown>;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
}

/**
 * Execute a workflow by processing nodes in topological order
 */
export async function executeWorkflowNodes(
    runId: string,
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    parallelGroups: string[][]
): Promise<void> {
    console.log(`\n[RUN ${runId}] Starting workflow execution`);
    console.log(`   [STATS] Total nodes: ${nodes.length}, Parallel groups: ${parallelGroups.length}`);

    const context: ExecutionContext = {
        runId,
        outputs: new Map(),
        nodes,
        edges,
    };

    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    try {
        // Execute groups in order
        for (let groupIndex = 0; groupIndex < parallelGroups.length; groupIndex++) {
            const group = parallelGroups[groupIndex];
            console.log(`\n   [GROUP ${groupIndex + 1}/${parallelGroups.length}] Executing ${group.length} node(s) in parallel`);

            // Execute nodes in parallel within each group
            await Promise.all(
                group.map(async (nodeId) => {
                    const node = nodeMap.get(nodeId);
                    if (!node) return;

                    const nodeType = node.data?.type || node.type;
                    console.log(`      [NODE] [${nodeType}] Starting node ${nodeId.slice(0, 8)}...`);

                    // Mark as running
                    await updateNodeLog(runId, nodeId, 'RUNNING');
                    const startTime = Date.now();

                    try {
                        // Get upstream outputs
                        const upstreamEdges = edges.filter(e => e.target === nodeId);
                        const upstreamData = upstreamEdges.map(e => ({
                            nodeId: e.source,
                            output: context.outputs.get(e.source),
                            sourceHandle: e.sourceHandle,
                        }));

                        if (upstreamData.length > 0) {
                            console.log(`         [INPUT] Received ${upstreamData.length} input(s)`);
                        }

                        // Execute the node
                        const output = await executeNode(node, upstreamData, context);
                        context.outputs.set(nodeId, output);

                        // Update node log with success
                        const duration = Date.now() - startTime;
                        const outputPreview = typeof output === 'string'
                            ? output.slice(0, 50) + (output.length > 50 ? '...' : '')
                            : JSON.stringify(output).slice(0, 50);
                        console.log(`      [SUCCESS] [${nodeType}] Completed in ${duration}ms - Output: ${outputPreview}`);

                        await updateNodeLog(runId, nodeId, 'SUCCESS', output, undefined, duration);
                    } catch (error) {
                        // Update node log with failure
                        const errorMessage = error instanceof Error ? error.message : 'Execution failed';
                        const duration = Date.now() - startTime;
                        console.error(`      [FAILED] [${nodeType}] Failed after ${duration}ms - Error: ${errorMessage}`);

                        await updateNodeLog(runId, nodeId, 'FAILED', undefined, errorMessage, duration);
                        throw error;
                    }
                })
            );
        }

        // Mark run as completed
        const totalDuration = Date.now() - (await getRunStartTime(runId));
        console.log(`\n[SUCCESS] [RUN ${runId}] Workflow completed successfully in ${totalDuration}ms\n`);

        await prisma.run.update({
            where: { id: runId },
            data: {
                status: 'COMPLETED',
                completedAt: new Date(),
                duration: totalDuration,
            },
        });
    } catch (error) {
        console.error(`\n [RUN ${runId}] Workflow failed - ${error instanceof Error ? error.message : 'Unknown error'}\n`);

        // Mark run as failed
        await prisma.run.update({
            where: { id: runId },
            data: {
                status: 'FAILED',
                completedAt: new Date(),
            },
        });
    }
}

/**
 * Execute a single node
 */
async function executeNode(
    node: WorkflowNode,
    upstreamData: Array<{ nodeId: string; output: unknown; sourceHandle?: string }>,
    context: ExecutionContext
): Promise<unknown> {
    const nodeType = node.data?.type as string || node.type;

    switch (nodeType) {
        case 'textNode':
            return executeTextNode(node, upstreamData);

        case 'imageUploadNode':
            return executeImageUploadNode(node);

        case 'cropImageNode':
            return executeCropImageNode(node, upstreamData, context);

        case 'videoUploadNode':
            return executeVideoUploadNode(node);

        case 'extractFrameNode':
            return executeExtractFrameNode(node, upstreamData, context);

        case 'llmNode':
            return executeLLMNode(node, upstreamData, context);

        default:
            throw new Error(`Unknown node type: ${nodeType}`);
    }
}

/**
 * Text Node: Simply outputs the user message
 */
async function executeTextNode(
    node: WorkflowNode,
    _upstreamData: Array<{ nodeId: string; output: unknown }>
): Promise<string> {
    const userMessage = node.data?.userMessage as string || '';
    return userMessage;
}

/**
 * Image Upload Node: Returns the uploaded image URL
 */
async function executeImageUploadNode(node: WorkflowNode): Promise<string> {
    const imageUrl = node.data?.imageUrl as string;
    if (!imageUrl) {
        throw new Error('No image uploaded');
    }
    return imageUrl;
}

/**
 * Video Upload Node: Returns the uploaded video URL
 */
async function executeVideoUploadNode(node: WorkflowNode): Promise<string> {
    const videoUrl = node.data?.videoUrl as string;
    if (!videoUrl) {
        throw new Error('No video uploaded');
    }
    return videoUrl;
}

/**
 * Crop Image Node: Crops the input image using sharp (local processing)
 */
async function executeCropImageNode(
    node: WorkflowNode,
    upstreamData: Array<{ nodeId: string; output: unknown }>,
    _context: ExecutionContext
): Promise<string> {
    // Get image from upstream
    const imageInput = upstreamData[0]?.output as string;
    if (!imageInput) {
        throw new Error('No image input connected');
    }

    const xPercent = (node.data?.xPercent as number) || 0;
    const yPercent = (node.data?.yPercent as number) || 0;
    const widthPercent = (node.data?.widthPercent as number) || 100;
    const heightPercent = (node.data?.heightPercent as number) || 100;

    console.log(`         [CROP] Params: x=${xPercent}%, y=${yPercent}%, w=${widthPercent}%, h=${heightPercent}%`);

    // Convert input to a Buffer
    let imageBuffer: Buffer;
    if (imageInput.startsWith('data:')) {
        // Base64 data URL from LLM node
        const base64Data = imageInput.split(',')[1];
        if (!base64Data) throw new Error('Invalid base64 data URL');
        imageBuffer = Buffer.from(base64Data, 'base64');
    } else if (imageInput.startsWith('http')) {
        // Remote URL — download it
        const response = await fetch(imageInput);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
    } else {
        throw new Error('Invalid image input — expected base64 data URL or HTTP URL');
    }

    // Get image dimensions
    const metadata = await sharp(imageBuffer).metadata();
    const imgWidth = metadata.width || 1024;
    const imgHeight = metadata.height || 1024;

    console.log(`         [DIMENSIONS] Image: ${imgWidth}x${imgHeight}`);

    // Calculate pixel-based crop region from percentages
    let left = Math.round((xPercent / 100) * imgWidth);
    let top = Math.round((yPercent / 100) * imgHeight);
    let cropWidth = Math.round((widthPercent / 100) * imgWidth);
    let cropHeight = Math.round((heightPercent / 100) * imgHeight);

    // Clamp offsets to valid range (must be < image dimensions)
    left = Math.min(left, Math.max(imgWidth - 1, 0));
    top = Math.min(top, Math.max(imgHeight - 1, 0));

    // Clamp dimensions to image bounds
    cropWidth = Math.min(cropWidth, imgWidth - left);
    cropHeight = Math.min(cropHeight, imgHeight - top);
    cropWidth = Math.max(cropWidth, 1);
    cropHeight = Math.max(cropHeight, 1);

    console.log(`         [CROP] Region: left=${left}, top=${top}, width=${cropWidth}, height=${cropHeight}`);

    // Crop with sharp
    const croppedBuffer = await sharp(imageBuffer)
        .extract({ left, top, width: cropWidth, height: cropHeight })
        .png()
        .toBuffer();

    // Production Storage (Cloudinary)
    if (process.env.CLOUDINARY_CLOUD_NAME) {
        try {
            const upload = await uploadToCloudinary(croppedBuffer, {
                folder: `weavy/crops`,
                resourceType: 'image',
            });
            console.log(`         [SUCCESS] Cropped image uploaded: ${upload.url}`);
            return upload.url;
        } catch (e) {
            console.warn(`         [WARN] Cloudinary upload failed, falling back to base64:`, e);
        }
    }

    // Return as base64 data URL (Fallback)
    const croppedBase64 = croppedBuffer.toString('base64');
    const result = `data:image/png;base64,${croppedBase64}`;

    console.log(`         [SUCCESS] Local output: ${cropWidth}x${cropHeight} (${croppedBase64.length} chars base64)`);

    return result;
}

/**
 * Extract Frame Node: Robust implementation using spawn and streaming download
 */
async function executeExtractFrameNode(
    node: WorkflowNode,
    upstreamData: Array<{ nodeId: string; output: unknown }>,
    context: ExecutionContext
): Promise<string> {
    const videoInput = upstreamData[0]?.output as string;
    if (!videoInput) {
        throw new Error('No video input connected');
    }


    const timestamp = (node.data?.timestamp as string) || '50%';
    console.log(`         [ACTION] Extract frame at timestamp: ${timestamp}`);

    // Optimization: If input is a Cloudinary video, use Cloudinary transformation (Serverless friendly)
    if (videoInput.includes('cloudinary.com')) {
        try {
            // Extract public_id: /upload/v1234/folder/name.mp4 -> folder/name
            const regex = /\/upload\/(?:v\d+\/)?(.+?)\.[a-zA-Z0-9]+$/;
            const match = videoInput.match(regex);
            if (match && match[1]) {
                const publicId = match[1];
                const { getVideoFrameUrl } = require('./cloudinary'); // Lazy import or ensure top-level
                const frameUrl = getVideoFrameUrl(publicId, timestamp);
                console.log(`         [SUCCESS] Generated Cloudinary frame URL: ${frameUrl}`);
                return frameUrl;
            }
        } catch (e) {
            console.warn(`         [WARN] Cloudinary optimization failed, falling back to local FFmpeg:`, e);
        }
    }

    // Create temp directory for processing
    const uniqueId = Math.random().toString(36).substring(7);
    const tmpDir = path.join(os.tmpdir(), `weavy-extract-${node.id}-${uniqueId}`);
    const videoPath = path.join(tmpDir, 'input_video');
    const framePath = path.join(tmpDir, 'frame.png');

    try {
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        // Write video to temp file (Streaming download)
        if (videoInput.startsWith('data:')) {
            const base64Data = videoInput.split(',')[1];
            if (!base64Data) throw new Error('Invalid base64 data URL');
            fs.writeFileSync(videoPath, Buffer.from(base64Data, 'base64'));
        } else if (videoInput.startsWith('http')) {
            console.log(`         Downloading video...`);
            await downloadVideo(videoInput, videoPath, 100 * 1024 * 1024); // 100MB limit
        } else {
            throw new Error('Invalid video input — expected base64 data URL or HTTP URL');
        }

        console.log(`         [FILE] Video written to temp file (${fs.statSync(videoPath).size} bytes)`);

        // Get Duration to handle percentage timestamps
        const duration = await getVideoDuration(videoPath);

        let seekSeconds: number;
        if (timestamp.endsWith('%')) {
            const percent = parseFloat(timestamp.replace('%', ''));
            if (isNaN(percent) || percent < 0 || percent > 100) {
                throw new Error(`Invalid percentage timestamp: ${timestamp}`);
            }
            seekSeconds = (percent / 100) * duration;
            console.log(`         [TIME] Video duration: ${duration.toFixed(2)}s, seeking to ${seekSeconds.toFixed(2)}s (${percent}%)`);
        } else {
            seekSeconds = parseFloat(timestamp.replace('s', ''));
            if (isNaN(seekSeconds) || seekSeconds < 0) {
                throw new Error(`Invalid timestamp: ${timestamp}`);
            }
            // Clamp
            if (seekSeconds > duration) seekSeconds = duration - 0.1;
            console.log(`         [TIME] Seeking to ${seekSeconds.toFixed(2)}s`);
        }

        // Extract using spawn (more robust/customizable than fluent-ffmpeg wrapper)
        await extractFrameParams(videoPath, seekSeconds, framePath);

        if (!fs.existsSync(framePath)) {
            throw new Error('Frame extraction failed — no output file produced');
        }

        const frameBuffer = fs.readFileSync(framePath);

        // Write to local public folder to avoid DB bloat and enable efficient serving
        // In production, upload to Cloudinary if configured
        if (process.env.CLOUDINARY_CLOUD_NAME) {
            try {
                const upload = await uploadToCloudinary(frameBuffer, {
                    folder: `weavy/frames/${context.runId}`,
                    resourceType: 'image',
                });
                console.log(`         [SUCCESS] Frame uploaded: ${upload.url}`);
                return upload.url;
            } catch (err) {
                console.warn(`         [WARN] Cloudinary upload failed:`, err);
            }
        }

        const publicDir = path.join(process.cwd(), 'public', 'outputs');
        try {
            if (!fs.existsSync(publicDir)) {
                fs.mkdirSync(publicDir, { recursive: true });
            }

            // Use consistent filename per node to avoid accumulation (overwrites properly)
            const outputFilename = `extract-${node.id}.png`;
            const outputPath = path.join(publicDir, outputFilename);
            fs.writeFileSync(outputPath, frameBuffer);

            // Return URL with cache buster
            const result = `/outputs/${outputFilename}?t=${Date.now()}`;
            console.log(`         [SUCCESS] Frame extracted to: ${result}`);
            return result;
        } catch (err) {
            console.error('Failed to write execution output to public folder:', err);
            // Fallback to base64 if FS fails (e.g. readonly environment), though this risks DB bloat again
            const base64 = frameBuffer.toString('base64');
            const result = `data:image/png;base64,${base64}`;
            console.log(`         [WARN] Fallback to base64 output (${base64.length} chars)`);
            return result;
        }

    } finally {
        // Cleanup temp working directory
        try {
            if (fs.existsSync(tmpDir)) {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            }
        } catch { /* ignore */ }
    }
}

/**
 * Helper: Download video stream to file
 */
async function downloadVideo(url: string, destPath: string, maxBytes: number): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);

        const fileStream = fs.createWriteStream(destPath);
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        let downloaded = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
                downloaded += value.length;
                if (downloaded > maxBytes) {
                    reader.cancel();
                    throw new Error('Video too large');
                }
                const canWrite = fileStream.write(value);
                if (!canWrite) await new Promise<void>(r => fileStream.once('drain', r));
            }
        }
        fileStream.end();
        await new Promise<void>((resolve, reject) => {
            fileStream.on('finish', resolve);
            fileStream.on('error', reject);
        });
    } finally {
        clearTimeout(timeout);
    }
}



/**
 * Helper: Extract Frame via Spawn
 */
function extractFrameParams(input: string, seek: number, output: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!ffmpegPath) return reject(new Error('FFmpeg binary not found'));

        // Fast seek before input
        const args = ['-ss', seek.toString(), '-i', input, '-vframes', '1', '-q:v', '2', '-y', output];
        console.log(`         🎞️  Spawn: ffmpeg ${args.join(' ')}`);
        // Safe spawn
        const child = spawn(ffmpegPath, args);
        let err = '';
        child.stderr.on('data', d => err += d.toString());

        child.on('close', code => {
            if (code !== 0) return reject(new Error(`ffmpeg exited code ${code}: ${err}`));
            resolve();
        });
    });
}

/**
 * LLM Node: Uses Groq (Llama3) for text and HuggingFace (SDXL) for images
 */
async function executeLLMNode(
    node: WorkflowNode,
    upstreamData: Array<{ nodeId: string; output: unknown }>,
    context: ExecutionContext
): Promise<string> {
    console.log(`         [AI] [LLM] Initializing AI provider...`);

    const groqKey = process.env.GROQ_API_KEY;
    const hfKey = process.env.HUGGINGFACE_API_KEY;

    if (!groqKey) {
        throw new Error('GROQ_API_KEY is not configured. Please set it in your .env file.');
    }

    // Collect text and image inputs from upstream nodes
    const textInputs: string[] = [];
    const imageUrls: string[] = [];

    console.log(`         [PROCESS] Processing ${upstreamData.length} upstream input(s)...`);

    for (const upstream of upstreamData) {
        const output = upstream.output;
        if (typeof output === 'string') {
            if (isImageUrl(output)) {
                console.log(`         [IMAGE] Detected image URL: ${output.slice(0, 60)}...`);
                imageUrls.push(output);
            } else {
                console.log(`         [TEXT] Detected text input: "${output.slice(0, 50)}${output.length > 50 ? '...' : ''}"`);
                textInputs.push(output);
            }
        }
    }

    const systemPrompt = (node.data?.systemPrompt as string) || '';
    if (systemPrompt) {
        console.log(`         [CONFIG] System prompt: "${systemPrompt.slice(0, 50)}${systemPrompt.length > 50 ? '...' : ''}"`);
    }

    // If upstream has image URLs, include them as context in the text prompt
    if (imageUrls.length > 0) {
        textInputs.push(`[The following image URLs were provided as input: ${imageUrls.join(', ')}]`);
    }

    const userText = textInputs.join('\n\n');
    if (!userText) {
        throw new Error('No inputs provided to LLM node');
    }

    // Intent detection: classify whether this is a text or image request
    const intent = await classifyIntentLocal(groqKey, userText);
    console.log(`         [INTENT] Detected: ${intent}`);

    if (intent === 'IMAGE' && hfKey) {
        return executeWithHuggingFace(hfKey, userText);
    }

    return executeWithGroq(groqKey, systemPrompt, textInputs);
}

/**
 * Classify user intent using Groq (text vs image)
 */
async function classifyIntentLocal(apiKey: string, prompt: string): Promise<'TEXT' | 'IMAGE'> {
    try {
        const groq = new Groq({ apiKey });
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `You are an intent classifier. Categorize the user's request as strictly either "TEXT" or "IMAGE".
- "IMAGE": If the user explicitly asks to generate, create, draw, or make an image, picture, photo, or art.
- "TEXT": For all other requests, including coding, writing, questions, summaries, etc.
Output ONLY the single word "TEXT" or "IMAGE". Do not output anything else.`,
                },
                { role: 'user', content: prompt },
            ],
            model: 'llama-3.1-8b-instant',
            temperature: 0,
            max_tokens: 5,
        });

        const intent = chatCompletion.choices[0]?.message?.content?.trim().toUpperCase();
        if (intent === 'IMAGE') return 'IMAGE';
        return 'TEXT';
    } catch (error) {
        console.error('         [WARN] Intent classification failed:', error);
        return 'TEXT'; // Fallback to text
    }
}

/**
 * Generate image using HuggingFace SDXL
 */
async function executeWithHuggingFace(apiKey: string, prompt: string): Promise<string> {
    console.log(`         [GENERATE] Using HuggingFace (Stable Diffusion XL)...`);

    const hf = new HfInference(apiKey);

    const blob = await hf.textToImage({
        model: 'stabilityai/stable-diffusion-xl-base-1.0',
        inputs: prompt,
        parameters: {
            guidance_scale: 7.5,
        },
    }) as unknown as Blob;

    const buffer = await blob.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mimeType = blob.type || 'image/png';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    console.log(`         [RESULT] Image generated (${base64.length} chars base64)`);
    return dataUrl;
}

async function executeWithGroq(
    apiKey: string,
    systemPrompt: string,
    textInputs: string[]
): Promise<string> {
    console.log(`         [RUN] Using Groq (Llama3)...`);

    const groq = new Groq({ apiKey });

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    // Add system prompt if provided
    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    } else {
        messages.push({
            role: 'system',
            content: 'You are a helpful, senior AI assistant. Provide concise, correct, and well-formatted responses. Use markdown when appropriate.',
        });
    }

    // Build user message from text inputs
    const userText = textInputs.join('\n\n');
    if (!userText) {
        throw new Error('No text inputs provided to LLM node');
    }

    messages.push({ role: 'user', content: userText });

    console.log(`         [SEND] Sending ${textInputs.length} text input(s) to Groq`);
    console.log(`         [RUN] Calling Groq API...`);

    const chatCompletion = await groq.chat.completions.create({
        messages,
        model: 'llama-3.1-8b-instant',
        temperature: 0.7,
        max_tokens: 1024,
    });

    const responseText = chatCompletion.choices[0]?.message?.content || '';
    console.log(`         [RESULT] Groq response received (${responseText.length} chars)`);

    return responseText;
}

// Helper functions

async function updateNodeLog(
    runId: string,
    nodeId: string,
    status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED',
    output?: unknown,
    error?: string,
    duration?: number
): Promise<void> {
    await prisma.nodeLog.updateMany({
        where: { runId, nodeId },
        data: {
            status,
            output: sanitizeOutput(output),
            error,
            duration,
            ...(status === 'RUNNING' ? { startedAt: new Date() } : {}),
            ...(['SUCCESS', 'FAILED'].includes(status) ? { completedAt: new Date() } : {}),
        },
    });
}

function sanitizeOutput(output: unknown): any {
    if (typeof output === 'string') {
        if (output.length > 1000) {
            return output.slice(0, 100) + '... [TRUNCATED ' + (output.length - 100) + ' chars]';
        }
    }
    return output;
}

async function getRunStartTime(runId: string): Promise<number> {
    const run = await prisma.run.findUnique({ where: { id: runId } });
    return run?.startedAt?.getTime() || Date.now();
}



function isImageUrl(url: string): boolean {
    // Must be a valid URL (http/https) or data URI
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:image/')) {
        return false;
    }

    // Check for data URI
    if (url.startsWith('data:image/')) {
        return true;
    }

    // Check for image file extensions
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];
    const lowerUrl = url.toLowerCase();

    // Check if URL ends with an image extension (with or without query params)
    return imageExtensions.some(ext => {
        return lowerUrl.includes(ext);
    });
}
