import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://sealsend:Seal2026!@10.0.1.30:5432/sealsend';

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: DATABASE_URL,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
