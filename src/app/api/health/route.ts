import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const startTime = Date.now();
  const healthChecks: Record<string, { status: 'healthy' | 'unhealthy'; details?: string; duration?: number }> = {};

  // App info
  const appInfo = {
    name: 'SealSend',
    version: process.env.npm_package_version || '0.1.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  };

  // Check 1: Database connectivity
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbDuration = Date.now() - dbStart;

    healthChecks.database = {
      status: 'healthy',
      details: 'Connected to database',
      duration: dbDuration,
    };
  } catch (error: any) {
    healthChecks.database = {
      status: 'unhealthy',
      details: error?.message || 'Database connection failed',
    };
  }

  // Check 2: Environment variables
  const requiredEnvVars = [
    'DATABASE_URL',
  ];

  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

  healthChecks.environment = {
    status: missingEnvVars.length === 0 ? 'healthy' : 'unhealthy',
    details: missingEnvVars.length === 0
      ? 'All required environment variables present'
      : `Missing: ${missingEnvVars.join(', ')}`,
  };

  // Determine overall status
  const allHealthy = Object.values(healthChecks).every(check => check.status === 'healthy');
  const statusCode = allHealthy ? 200 : 503;
  const overallStatus = allHealthy ? 'healthy' : 'unhealthy';

  const totalDuration = Date.now() - startTime;

  const response = {
    status: overallStatus,
    timestamp: appInfo.timestamp,
    version: appInfo.version,
    environment: appInfo.environment,
    checks: healthChecks,
    duration: totalDuration,
    uptime: process.uptime(),
  };

  return NextResponse.json(response, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Content-Type': 'application/json',
    },
  });
}

// Allow HEAD requests for health checks
export async function HEAD() {
  const response = await GET();
  return new NextResponse(null, {
    status: response.status,
    headers: response.headers,
  });
}
