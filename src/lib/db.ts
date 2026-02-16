import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

// Create pool for connection
const connectionString = process.env.DATABASE_URL || '';

// Only create pool if we have a connection string (avoid errors in build)
let prisma: PrismaClient;

if (connectionString) {
    const pool = new pg.Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });
} else {
    // Fallback for build time - will fail at runtime if DATABASE_URL is not set
    prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter: undefined as any });
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
