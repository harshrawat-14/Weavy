
import Groq from 'groq-sdk';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

export async function* generateTextStream(prompt: string) {
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful, senior AI assistant (Weavy Clone). You provide concise, correct, and formatting-friendly responses. Use markdown output.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            model: 'llama-3.1-8b-instant',
            temperature: 0.7,
            max_tokens: 1024,
            stream: true,
        });

        for await (const chunk of chatCompletion) {
            const content = chunk.choices[0]?.delta?.content || '';
            yield content;
        }
    } catch (error) {
        console.error('Groq text generation failed:', error);
        yield "I'm sorry, I encountered an error while processing your request.";
        throw error;
    }
}
