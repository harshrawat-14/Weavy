import { task } from "@trigger.dev/sdk/v3";
import Groq from "groq-sdk";

interface LLMInferencePayload {
    systemPrompt?: string;
    textInputs: string[];
    imageUrls: string[];
    nodeId: string;
    runId: string;
}

export const llmInferenceTask = task({
    id: "llm-inference",
    maxDuration: 120,
    run: async (payload: LLMInferencePayload) => {
        const { systemPrompt, textInputs, imageUrls, nodeId, runId } = payload;

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            throw new Error("GROQ_API_KEY not configured");
        }

        const groq = new Groq({ apiKey });

        // Build messages array
        const messages: Array<{ role: 'system' | 'user'; content: string }> = [];

        // Add system prompt if provided
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        } else {
            messages.push({
                role: 'system',
                content: 'You are a helpful AI assistant. Provide concise, correct responses.',
            });
        }

        // Build user message from text inputs
        const userParts: string[] = [...textInputs];

        // Include image URLs as context (Llama3 is text-only)
        if (imageUrls.length > 0) {
            userParts.push(`[Image URLs provided: ${imageUrls.join(', ')}]`);
        }

        if (userParts.length === 0) {
            throw new Error("No inputs provided to LLM task");
        }

        messages.push({ role: 'user', content: userParts.join('\n\n') });

        // Generate response using Groq Llama3
        const chatCompletion = await groq.chat.completions.create({
            messages,
            model: 'llama-3.1-8b-instant',
            temperature: 0.7,
            max_tokens: 1024,
        });

        const text = chatCompletion.choices[0]?.message?.content || '';

        return {
            nodeId,
            runId,
            output: text,
            success: true,
        };
    },
});
