
'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    type: 'text' | 'image';
}

export function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: Message = { role: 'user', content: input, type: 'text' };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: userMessage.content }),
            });

            if (!response.ok) throw new Error('Failed to fetch response');

            const contentType = response.headers.get('Content-Type');

            // Check if response is Streaming Text (text/plain) or JSON (application/json)
            if (contentType?.includes('application/json')) {
                // Handle JSON response (Image or Error)
                const data = await response.json();

                if (data.type === 'IMAGE') {
                    const assistantMessage: Message = {
                        role: 'assistant',
                        content: `![Generated Image](${data.content})`, // Using markdown image syntax
                        type: 'image'
                    };
                    setMessages((prev) => [...prev, assistantMessage]);
                } else {
                    // Handle error or fallback text
                    const assistantMessage: Message = {
                        role: 'assistant',
                        content: data.content || data.error || 'Something went wrong.',
                        type: 'text'
                    };
                    setMessages((prev) => [...prev, assistantMessage]);
                }
            } else {
                // Handle Streaming Text Response
                const reader = response.body?.getReader();
                const decoder = new TextDecoder();

                if (!reader) return;

                // Create empty assistant message first
                const assistantMessage: Message = { role: 'assistant', content: '', type: 'text' };
                setMessages((prev) => [...prev, assistantMessage]);

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });

                    // Update the last message with new chunk
                    setMessages((prev) => {
                        const newMessages = [...prev];
                        const lastMsgIndex = newMessages.length - 1;
                        const lastMsg = newMessages[lastMsgIndex];

                        // Ensure we are appending to the assistant's message
                        if (lastMsg.role === 'assistant') {
                            newMessages[lastMsgIndex] = {
                                ...lastMsg,
                                content: lastMsg.content + chunk
                            };
                        }
                        return newMessages;
                    });
                }
            }
        } catch (error) {
            console.error('Chat error:', error);
            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: 'Internal error. Please check backend logs.', type: 'text' },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[600px] bg-[#0a0a0a] rounded-lg border border-[#2a2a2a] overflow-hidden">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${msg.role === 'user'
                                ? 'bg-blue-600 text-white rounded-br-none'
                                : 'bg-[#1a1a1a] text-gray-200 rounded-bl-none border border-[#333]'
                                }`}
                        >
                            {msg.type === 'image' ? (
                                // Render image content (Markdown syntax ![alt](url) -> extracts URL)
                                <img
                                    src={msg.content.match(/\((.*?)\)/)?.[1] || ''}
                                    alt="Generated"
                                    className="rounded-lg max-w-full h-auto mt-1 border border-gray-700"
                                />
                            ) : (
                                <div className="prose prose-invert prose-sm max-w-none">
                                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-[#1a1a1a] px-4 py-2 rounded-2xl rounded-bl-none border border-[#333] flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                            <span className="text-gray-400 text-xs">Thinking...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-[#2a2a2a] bg-[#111]">
                <div className="relative flex items-center">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type a message or describe an image..."
                        className="w-full bg-[#1a1a1a] border border-[#333] text-gray-200 rounded-full py-3 pl-4 pr-12 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors placeholder:text-gray-600"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                </div>
                <div className="text-center mt-2">
                    <p className="text-[10px] text-gray-600">
                        Powered by Groq (Llama3) & HuggingFace (SDXL)
                    </p>
                </div>
            </form>
        </div>
    );
}
