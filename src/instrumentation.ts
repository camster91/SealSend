export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL || process.env.NEXT_PHASE === "phase-production-build") return;
  // Deployment startup is an authorized migration boundary. Complete the
  // additive upgrade before the container can report healthy.
  const { ensureSocialSchema } = await import("@/lib/social/access");
  await ensureSocialSchema();
}

export async function onRequestError(
  error: unknown,
  request: { method: string },
  context: { routePath: string; routerKind: string; routeType: string },
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { captureServerError } = await import("@/lib/monitoring/server-errors");
  await captureServerError(error, { route: context.routePath, method: request.method, routerKind: context.routerKind, routeType: context.routeType });
}
