import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/db';

// GET /api/workflows - List workflows for current user
export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const workflows = await prisma.workflow.findMany({
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

        return NextResponse.json({ workflows });
    } catch (error) {
        console.error('Failed to fetch workflows:', error);
        return NextResponse.json(
            { error: 'Failed to fetch workflows' },
            { status: 500 }
        );
    }
}

// POST /api/workflows - Create new workflow
export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, description, nodes, edges } = body;

        const workflow = await prisma.workflow.create({
            data: {
                userId,
                name: name || 'Untitled Workflow',
                description,
                nodes: nodes || [],
                edges: edges || [],
            }
        });

        return NextResponse.json(workflow, { status: 201 });
    } catch (error) {
        console.error('Failed to create workflow:', error);
        return NextResponse.json(
            { error: 'Failed to create workflow' },
            { status: 500 }
        );
    }
}
