import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

// Buttons whose only content is an icon need an accessible name. `tooltip` on
// the shared Button component is rendered as aria-label, so it counts.
const NAMING_ATTRIBUTES = new Set(['aria-label', 'aria-labelledby', 'tooltip']);

function findUnlabelledIconButtons(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings: string[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node)) {
      const tag = node.openingElement.tagName.getText();
      if (tag === 'button' || tag === 'Button') {
        const attributes = node.openingElement.attributes.properties;
        const hasSpread = attributes.some(ts.isJsxSpreadAttribute);
        const hasName = attributes.some((attribute) => ts.isJsxAttribute(attribute) && NAMING_ATTRIBUTES.has(attribute.name.getText()));
        const children = node.children.filter((child) => !(ts.isJsxText(child) && child.text.trim() === ''));
        const iconOnly = children.length > 0 && children.every((child) => ts.isJsxSelfClosingElement(child) && /^[A-Z]/.test(child.tagName.getText()));

        if (iconOnly && !hasName && !hasSpread) {
          const { line } = source.getLineAndCharacterOfPosition(node.getStart());
          findings.push(`${file}:${line + 1}`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return findings;
}

test('icon-only buttons have an accessible name', () => {
  const files = execFileSync('git', ['ls-files', 'src/**/*.tsx'], { encoding: 'utf8' }).trim().split('\n');
  assert.ok(files.length > 50, 'expected to scan the component tree');

  const findings = files.flatMap(findUnlabelledIconButtons);
  assert.deepEqual(findings, [], `Add aria-label (or tooltip on <Button>) to:\n${findings.join('\n')}`);
});
