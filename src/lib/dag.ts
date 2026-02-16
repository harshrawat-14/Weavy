// Generic interfaces for DAG operations to support React Flow types
interface DAGNode {
    id: string;
}

interface DAGEdge {
    source: string;
    target: string;
}

/**
 * Validates that a workflow is a valid DAG (no cycles)
 */
export function validateDAG(nodes: DAGNode[], edges: DAGEdge[]): { valid: boolean; error?: string } {
    const nodeIds = new Set(nodes.map(n => n.id));
    const adjacencyList = new Map<string, string[]>();

    // Build adjacency list
    nodeIds.forEach(id => adjacencyList.set(id, []));

    for (const edge of edges) {
        if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
            return { valid: false, error: `Edge references non-existent node` };
        }
        adjacencyList.get(edge.source)!.push(edge.target);
    }

    // Detect cycles using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    function hasCycle(nodeId: string): boolean {
        visited.add(nodeId);
        recursionStack.add(nodeId);

        const neighbors = adjacencyList.get(nodeId) || [];
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                if (hasCycle(neighbor)) return true;
            } else if (recursionStack.has(neighbor)) {
                return true;
            }
        }

        recursionStack.delete(nodeId);
        return false;
    }

    for (const nodeId of nodeIds) {
        if (!visited.has(nodeId)) {
            if (hasCycle(nodeId)) {
                return { valid: false, error: 'Workflow contains a cycle' };
            }
        }
    }

    return { valid: true };
}

/**
 * Gets topologically sorted order of nodes
 */
export function topologicalSort(nodes: DAGNode[], edges: DAGEdge[]): string[] {
    const nodeIds = nodes.map(n => n.id);
    const inDegree = new Map<string, number>();
    const adjacencyList = new Map<string, string[]>();

    // Initialize
    nodeIds.forEach(id => {
        inDegree.set(id, 0);
        adjacencyList.set(id, []);
    });

    // Build graph
    for (const edge of edges) {
        adjacencyList.get(edge.source)!.push(edge.target);
        inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }

    // Find nodes with no dependencies
    const queue: string[] = [];
    inDegree.forEach((degree, nodeId) => {
        if (degree === 0) queue.push(nodeId);
    });

    const sorted: string[] = [];

    while (queue.length > 0) {
        const nodeId = queue.shift()!;
        sorted.push(nodeId);

        for (const neighbor of adjacencyList.get(nodeId) || []) {
            inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
            if (inDegree.get(neighbor) === 0) {
                queue.push(neighbor);
            }
        }
    }

    return sorted;
}

/**
 * Gets groups of nodes that can be executed in parallel
 */
export function getParallelGroups(nodes: DAGNode[], edges: DAGEdge[]): string[][] {
    const nodeIds = new Set(nodes.map(n => n.id));
    const inDegree = new Map<string, number>();
    const adjacencyList = new Map<string, string[]>();

    // Initialize
    nodeIds.forEach(id => {
        inDegree.set(id, 0);
        adjacencyList.set(id, []);
    });

    // Build graph
    for (const edge of edges) {
        if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
            adjacencyList.get(edge.source)!.push(edge.target);
            inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
        }
    }

    const groups: string[][] = [];
    const remaining = new Set(nodeIds);

    while (remaining.size > 0) {
        // Find all nodes with in-degree 0 from remaining nodes
        const currentGroup: string[] = [];

        for (const nodeId of remaining) {
            if (inDegree.get(nodeId) === 0) {
                currentGroup.push(nodeId);
            }
        }

        if (currentGroup.length === 0) {
            // Should not happen if DAG is valid
            break;
        }

        groups.push(currentGroup);

        // Remove current group and update in-degrees
        for (const nodeId of currentGroup) {
            remaining.delete(nodeId);
            for (const neighbor of adjacencyList.get(nodeId) || []) {
                if (remaining.has(neighbor)) {
                    inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
                }
            }
        }
    }

    return groups;
}

/**
 * Gets all upstream nodes (dependencies) for a given node
 */
export function getUpstreamNodes(nodeId: string, nodes: DAGNode[], edges: DAGEdge[]): string[] {
    const nodeIds = new Set(nodes.map(n => n.id));
    const reverseAdjacency = new Map<string, string[]>();

    // Build reverse adjacency (target -> sources)
    nodeIds.forEach(id => reverseAdjacency.set(id, []));

    for (const edge of edges) {
        if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
            reverseAdjacency.get(edge.target)!.push(edge.source);
        }
    }

    // BFS to find all upstream nodes
    const visited = new Set<string>();
    const queue = [nodeId];

    while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);

        for (const parent of reverseAdjacency.get(current) || []) {
            if (!visited.has(parent)) {
                queue.push(parent);
            }
        }
    }

    // Remove the original node from results
    visited.delete(nodeId);
    return Array.from(visited);
}

/**
 * Gets all downstream nodes (dependents) for a given node
 */
export function getDownstreamNodes(nodeId: string, nodes: DAGNode[], edges: DAGEdge[]): string[] {
    const nodeIds = new Set(nodes.map(n => n.id));
    const adjacencyList = new Map<string, string[]>();

    // Build adjacency list
    nodeIds.forEach(id => adjacencyList.set(id, []));

    for (const edge of edges) {
        if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
            adjacencyList.get(edge.source)!.push(edge.target);
        }
    }

    // BFS to find all downstream nodes
    const visited = new Set<string>();
    const queue = [nodeId];

    while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);

        for (const child of adjacencyList.get(current) || []) {
            if (!visited.has(child)) {
                queue.push(child);
            }
        }
    }

    // Remove the original node from results
    visited.delete(nodeId);
    return Array.from(visited);
}

/**
 * Gets direct parent nodes for a given node
 */
export function getParentNodes(nodeId: string, edges: DAGEdge[]): string[] {
    return edges
        .filter(edge => edge.target === nodeId)
        .map(edge => edge.source);
}

/**
 * Gets direct child nodes for a given node
 */
export function getChildNodes(nodeId: string, edges: DAGEdge[]): string[] {
    return edges
        .filter(edge => edge.source === nodeId)
        .map(edge => edge.target);
}

/**
 * Filters nodes to only include selected nodes and their required dependencies
 */
export function getExecutionSubgraph<T extends DAGNode>(
    selectedNodeIds: string[],
    nodes: T[],
    edges: DAGEdge[]
): { nodes: T[]; edges: DAGEdge[] } {
    const allRequired = new Set<string>(selectedNodeIds);

    // Add all upstream dependencies for each selected node
    for (const nodeId of selectedNodeIds) {
        const upstream = getUpstreamNodes(nodeId, nodes, edges);
        upstream.forEach(id => allRequired.add(id));
    }

    const filteredNodes = nodes.filter(n => allRequired.has(n.id));
    const filteredEdges = edges.filter(
        e => allRequired.has(e.source) && allRequired.has(e.target)
    );

    return { nodes: filteredNodes, edges: filteredEdges };
}
