import { UserButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';
import prisma from '@/lib/db';
import { Plus, Zap, Clock, GitBranch, Trash2 } from 'lucide-react';
import WorkflowCard from '@/components/dashboard/WorkflowCard';

export default async function DashboardPage() {
    const { userId } = await auth();

    if (!userId) {
        return null;
    }

    let workflows: { id: string; name: string; description: string | null; updatedAt: Date; _count: { runs: number } }[] = [];

    try {
        workflows = await prisma.workflow.findMany({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
            select: {
                id: true,
                name: true,
                description: true,
                updatedAt: true,
                _count: {
                    select: { runs: true }
                }
            }
        });
    } catch {
        // Database might not be set up yet
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
            {/* Header */}
            <header className="border-b border-slate-800/50 backdrop-blur-lg bg-slate-950/60 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard" className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                <Zap className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                                Weavy
                            </span>
                        </Link>
                    </div>
                    <UserButton
                        appearance={{
                            elements: {
                                avatarBox: 'w-10 h-10',
                            }
                        }}
                    />
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-12">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold">Your Workflows</h1>
                        <p className="text-slate-400 mt-1">Create and manage your AI workflows</p>
                    </div>
                    <Link href="/workflow/new" className="btn btn-primary">
                        <Plus className="w-5 h-5" />
                        New Workflow
                    </Link>
                </div>

                {workflows.length === 0 ? (
                    <div className="card text-center py-16">
                        <GitBranch className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold mb-2">No workflows yet</h2>
                        <p className="text-slate-400 mb-6">Create your first AI workflow to get started</p>
                        <Link href="/workflow/new" className="btn btn-primary">
                            <Plus className="w-5 h-5" />
                            Create Workflow
                        </Link>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {workflows.map((workflow) => (
                            <WorkflowCard key={workflow.id} workflow={workflow} />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
