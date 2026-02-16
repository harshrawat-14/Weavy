import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/db';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/runs/[id] - Get single run with node logs
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        const run = await prisma.run.findFirst({
            where: { id, userId },
            include: {
                nodeLogs: {
                    orderBy: { startedAt: 'asc' },
                },
            },
        });

        if (!run) {
            return NextResponse.json({ error: 'Run not found' }, { status: 404 });
        }

        return NextResponse.json(run);
    } catch (error) {
        console.error('Failed to fetch run:', error);
        return NextResponse.json(
            { error: 'Failed to fetch run' },
            { status: 500 }
        );
    }
}

// DELETE /api/runs/[id] - Cancel/delete a run
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        // Verify ownership
        const existing = await prisma.run.findFirst({
            where: { id, userId },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Run not found' }, { status: 404 });
        }

        // If running, mark as cancelled
        if (existing.status === 'RUNNING' || existing.status === 'PENDING') {
            await prisma.run.update({
                where: { id },
                data: {
                    status: 'CANCELLED',
                    completedAt: new Date(),
                },
            });
        } else {
            await prisma.run.delete({
                where: { id },
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete run:', error);
        return NextResponse.json(
            { error: 'Failed to delete run' },
            { status: 500 }
        );
    }
}
