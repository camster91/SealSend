import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

// A Node core import reachable from a "use client" module makes the bundler ship
// browser polyfills. crypto-browserify pulls in vm-browserify, whose eval() trips
// the production CSP (no unsafe-eval) on every page, see issue #151.
const NODE_BUILTINS = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));

function resolveLocal(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) base = path.join('src', specifier.slice(2));
  else if (specifier.startsWith('.')) base = path.join(path.dirname(fromFile), specifier);
  else return null;

  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    if (/\.tsx?$/.test(candidate) && existsSync(candidate)) return path.normalize(candidate);
  }
  return null;
}

function runtimeImports(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && !statement.importClause?.isTypeOnly) {
      specifiers.push((statement.moduleSpecifier as ts.StringLiteral).text);
    } else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && !statement.isTypeOnly) {
      specifiers.push((statement.moduleSpecifier as ts.StringLiteral).text);
    }
  }
  return specifiers;
}

test('client components never reach a Node core module through local imports', () => {
  const clientEntries = execFileSync('git', ['ls-files', 'src/**/*.ts', 'src/**/*.tsx'], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter((file) => /^\s*['"]use client['"]/.test(readFileSync(file, 'utf8')));
  assert.ok(clientEntries.length > 20, 'expected to find client components');

  const violations: string[] = [];
  const visited = new Set<string>();
  const queue = clientEntries.map((file) => ({ file, chain: [file] }));

  while (queue.length > 0) {
    const { file, chain } = queue.shift()!;
    if (visited.has(file)) continue;
    visited.add(file);

    for (const specifier of runtimeImports(file)) {
      if (NODE_BUILTINS.has(specifier)) {
        violations.push(`${chain.join(' -> ')} imports "${specifier}"`);
        continue;
      }
      const resolved = resolveLocal(file, specifier);
      if (resolved && !visited.has(resolved)) queue.push({ file: resolved, chain: [...chain, resolved] });
    }
  }

  assert.deepEqual(violations, [], `Move Node-only code out of client-reachable modules:\n${violations.join('\n')}`);
});
