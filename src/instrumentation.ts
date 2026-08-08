export async function register() {}

export async function onRequestError(
  error: unknown,
  request: { method: string },
  context: { routePath: string; routerKind: string; routeType: string },
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { captureServerError } = await import("@/lib/monitoring/server-errors");
  await captureServerError(error, { route: context.routePath, method: request.method, routerKind: context.routerKind, routeType: context.routeType });
}
