
import { NextRequest, NextResponse } from 'next/server';
import { classifyIntent } from '@/lib/ai/classifier';
import { generateTextStream } from '@/lib/ai/text';
import { generateImage } from '@/lib/ai/image';

interface ChatRequestBody {
    prompt: string;
}

export async function POST(req: NextRequest) {
    try {
        const { prompt }: ChatRequestBody = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        // 1. Classify Intent
        const intent = await classifyIntent(prompt);
        console.log(`Intent Detected: ${intent}`);

        // IMAGE Handling
        if (intent === 'IMAGE') {
            try {
                const imageBase64 = await generateImage(prompt);
                // Respond with JSON since image generation is typically "one big thing".
                // If you want streaming "loading" effect, you can stream text saying "Generating image..." and then send image URL.
                // For simplicity, we just return JSON here.
                return NextResponse.json({ type: 'IMAGE', content: imageBase64 });
            } catch (error) {
                console.error('Image generation error:', error);
                // Fallback to text if image fails
                // Or return 429/500
                return NextResponse.json({ type: 'TEXT', content: `Sorry, unable to generate image at this time: ${(error as Error).message}` });
            }
        }

        // TEXT Handling (Streaming)
        // Create a ReadableStream manually for maximum control
        const textStream = new ReadableStream({
            async start(controller) {
                // Send initial chunk indicating type
                // We separate metadata from content with a delimiter or JSON structure if needed.
                // Standard SSE format: `data: ...\n\n`

                const encoder = new TextEncoder();

                try {
                    // Send initial intent marker (frontend can parse this)
                    // Or just stream raw text.
                    // Let's stream raw text for simplicity as the frontend expects simple text.
                    // Using Vercel AI SDK on frontend handles plain text streams well.

                    // Standard text generation
                    for await (const chunk of generateTextStream(prompt)) {
                        if (chunk) {
                            controller.enqueue(encoder.encode(chunk));
                        }
                    }
                } catch (e) {
                    controller.error(e);
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(textStream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'X-Intent': 'TEXT', // Header based intent type for frontend handling if needed
            },
        });

    } catch (error) {
        console.error('Chat API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
