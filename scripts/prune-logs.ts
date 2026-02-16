import 'dotenv/config';
import prisma from '../src/lib/db';

async function main() {
    console.log('🗑️  Pruning bloated database logs...');

    try {
        // Delete all Runs (cascades to NodeLogs)
        const { count } = await prisma.run.deleteMany({});
        console.log(`✅ Deleted ${count} runs and associated logs.`);
    } catch (error) {
        console.error('❌ Failed to prune logs:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
