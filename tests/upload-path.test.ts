import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { resolveUploadPath } from '../src/lib/upload-path';

test('resolves a file inside the uploads directory', () => {
  const base = path.resolve('uploads');
  assert.equal(
    resolveUploadPath(base, ['user-id', 'invitation.webp']),
    path.join(base, 'user-id', 'invitation.webp')
  );
});

test('rejects traversal into a sibling whose name shares the uploads prefix', () => {
  const base = path.resolve('uploads');
  assert.equal(resolveUploadPath(base, ['..', 'uploads-secret', 'token.txt']), null);
});

test('rejects empty and dot path segments', () => {
  const base = path.resolve('uploads');
  assert.equal(resolveUploadPath(base, []), null);
  assert.equal(resolveUploadPath(base, ['user-id', '..', 'token.txt']), null);
});
