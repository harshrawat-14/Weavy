
import { HfInference } from '@huggingface/inference';

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// You may need to change models depending on availability/loading/permissions.
// Stable Diffusion XL Base 1.0 is a solid choice. Also 'stabilityai/stable-diffusion-2-1'.
const MODEL = 'stabilityai/stable-diffusion-xl-base-1.0';

export async function generateImage(prompt: string): Promise<string> {
    try {
        const blob = await hf.textToImage({
            model: MODEL,
            inputs: prompt,
            parameters: {
                guidance_scale: 7.5,
            },
        }) as unknown as Blob;

        // Convert Blob to buffer/base64 so frontend can display it easily.
        const buffer = await blob.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const mimeType = blob.type || 'image/png';

        return `data:${mimeType};base64,${base64}`;
    } catch (error) {
        console.error('HuggingFace image generation failed:', error);
        // If loading (503), you could return a "loading" message or image link placeholder
        // HF Inference API often returns 503 "Model is loading", handle gracefully on frontend ideally.
        if (error instanceof Error && error.message?.includes('503')) {
            throw new Error("Model is currently loading. Please try again in ~30 seconds.");
        }
        throw error;
    }
}
