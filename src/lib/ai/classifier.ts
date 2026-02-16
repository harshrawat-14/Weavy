
import Groq from 'groq-sdk';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

export type Intent = 'TEXT' | 'IMAGE';

export async function classifyIntent(prompt: string): Promise<Intent> {
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `You are an intent classifier. Categorize the user's request as strictly either "TEXT" or "IMAGE".
          - "IMAGE": If the user explicitly asks to generate, create, draw, or make an image, picture, photo, or art.
          - "TEXT": For all other requests, including coding, writing, questions, summaries, etc.
          Output ONLY the single word "TEXT" or "IMAGE". Do not output anything else.`,
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            model: 'llama-3.1-8b-instant',
            temperature: 0,
            max_tokens: 5,
        });

        const intent = chatCompletion.choices[0]?.message?.content?.trim().toUpperCase();

        if (intent === 'IMAGE') return 'IMAGE';
        return 'TEXT'; // Default to text for safety
    } catch (error) {
        console.error('Intent classification failed:', error);
        return 'TEXT'; // Fallback
    }
}
