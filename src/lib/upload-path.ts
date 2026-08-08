import path from 'node:path';

export function resolveUploadPath(baseDirectory: string, segments: string[]): string | null {
  if (
    segments.length === 0 ||
    segments.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..' ||
        segment.includes('/') ||
        segment.includes('\\') ||
        segment.includes('\0')
    )
  ) {
    return null;
  }

  const base = path.resolve(baseDirectory);
  const candidate = path.resolve(base, ...segments);
  const relative = path.relative(base, candidate);

  if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
    return null;
  }

  return candidate;
}
