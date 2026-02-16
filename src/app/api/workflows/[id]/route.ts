import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/db';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/workflows/[id] - Get single workflow
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        const workflow = await prisma.workflow.findFirst({
            where: { id, userId },
        });

        if (!workflow) {
            return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
        }

        return NextResponse.json(workflow);
    } catch (error) {
        console.error('Failed to fetch workflow:', error);
        return NextResponse.json(
            { error: 'Failed to fetch workflow' },
            { status: 500 }
        );
    }
}

// PUT /api/workflows/[id] - Update workflow
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const { name, description, nodes, edges } = body;
        console.log(`[API/Workflow/PUT ${id}] Updating workflow: ${name} (${nodes?.length} nodes)`);

        // Verify ownership
        const existing = await prisma.workflow.findFirst({
            where: { id, userId },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
        }

        const workflow = await prisma.workflow.update({
            where: { id },
            data: {
                name,
                description,
                nodes,
                edges,
            }


        });
        console.log(`[API/Workflow/PUT ${id}] Update success`);

        return NextResponse.json(workflow);
    } catch (error) {
        console.error('Failed to update workflow:', error);
        return NextResponse.json(
            { error: 'Failed to update workflow' },
            { status: 500 }
        );
    }
}

// DELETE /api/workflows/[id] - Delete workflow
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        // Verify ownership
        const existing = await prisma.workflow.findFirst({
            where: { id, userId },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
        }

        await prisma.workflow.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete workflow:', error);
        return NextResponse.json(
            { error: 'Failed to delete workflow' },
            { status: 500 }
        );
    }
}
