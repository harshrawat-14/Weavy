
import { ChatInterface } from '@/components/chat/Chat';

export default function ChatPage() {
    return (
        <div className="flex h-screen bg-[#050505] p-6 justify-center">
            <div className="w-full max-w-4xl flex flex-col gap-6">
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                    Weavy AI Assistant
                </h1>
                <ChatInterface />
            </div>
        </div>
    );
}
