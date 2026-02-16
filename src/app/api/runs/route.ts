import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/db';
import { validateDAG, getParallelGroups, getExecutionSubgraph } from '@/lib/dag';
import { executeWorkflowNodes } from '@/lib/execution';

// GET /api/runs - List runs for a workflow
export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const workflowId = searchParams.get('workflowId');

        if (!workflowId) {
            return NextResponse.json({ error: 'workflowId required' }, { status: 400 });
        }

        // Verify workflow ownership
        const workflow = await prisma.workflow.findFirst({
            where: { id: workflowId, userId },
        });

        if (!workflow) {
            return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
        }

        const runs = await prisma.run.findMany({
            where: { workflowId },
            orderBy: { startedAt: 'desc' },
            take: 20,
            include: {
                nodeLogs: {
                    orderBy: { startedAt: 'asc' },
                },
            },
        });

        return NextResponse.json({ runs });
    } catch (error) {
        console.error('Failed to fetch runs:', error);
        return NextResponse.json(
            { error: 'Failed to fetch runs' },
            { status: 500 }
        );
    }
}

// POST /api/runs - Start a new run (trigger execution)
export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { workflowId, nodes, edges, scope = 'FULL', selectedNodes } = body;

        // Validate DAG
        const validation = validateDAG(nodes, edges);
        if (!validation.valid) {
            return NextResponse.json(
                { error: validation.error || 'Invalid workflow graph' },
                { status: 400 }
            );
        }

        // Determine which nodes to execute
        let nodesToExecute = nodes;
        let edgesToExecute = edges;

        if (scope !== 'FULL' && selectedNodes?.length > 0) {
            const subgraph = getExecutionSubgraph(selectedNodes, nodes, edges);
            nodesToExecute = subgraph.nodes;
            edgesToExecute = subgraph.edges;
        }

        // Get parallel execution groups
        const parallelGroups = getParallelGroups(nodesToExecute, edgesToExecute);

        // If no workflowId provided (new/unsaved workflow), auto-save it first
        let resolvedWorkflowId = workflowId;
        if (!resolvedWorkflowId) {
            const newWorkflow = await prisma.workflow.create({
                data: {
                    userId,
                    name: 'Untitled Workflow',
                    nodes: JSON.parse(JSON.stringify(nodes)),
                    edges: JSON.parse(JSON.stringify(edges)),
                },
            });
            resolvedWorkflowId = newWorkflow.id;
        }

        // Create run record
        const run = await prisma.run.create({
            data: {
                workflowId: resolvedWorkflowId,
                userId,
                status: 'RUNNING',
                scope: scope.toUpperCase() as 'SINGLE' | 'PARTIAL' | 'FULL',
                selectedNodes: selectedNodes || [],
            },
        });

        // Create pending node logs
        const nodeLogPromises = nodesToExecute.map((node: { id: string; data: { type: string } }) =>
            prisma.nodeLog.create({
                data: {
                    runId: run.id,
                    nodeId: node.id,
                    nodeType: node.data?.type || 'unknown',
                    status: 'PENDING',
                },
            })
        );

        await Promise.all(nodeLogPromises);

        // Execute workflow in background (don't await)
        // This allows the API to return immediately while execution happens
        executeWorkflowNodes(run.id, nodesToExecute, edgesToExecute, parallelGroups)
            .catch(err => console.error('Workflow execution error:', err));

        return NextResponse.json({
            runId: run.id,
            workflowId: resolvedWorkflowId,
            parallelGroups: parallelGroups.length,
        }, { status: 201 });
    } catch (error) {
        console.error('Failed to start run:', error);
        return NextResponse.json(
            { error: 'Failed to start run' },
            { status: 500 }
        );
    }
}
