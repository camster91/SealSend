import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Input } from '../src/components/ui/Input';

test('unidentified labeled inputs receive distinct associated IDs', () => {
  const markup = renderToStaticMarkup(<><Input label="Invite by email" /><Input label="Workspace name" /></>);
  const labels = [...markup.matchAll(/<label[^>]*for="([^"]+)"/g)].map(match => match[1]);
  const inputs = [...markup.matchAll(/<input[^>]*id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(labels.length, 2);
  assert.equal(new Set(labels).size, 2);
  assert.deepEqual(labels, inputs);
});

test('explicit input IDs and existing descriptions survive error association', () => {
  const markup = renderToStaticMarkup(<Input id="invite-email" label="Email" error="Enter a valid email" aria-describedby="invite-help" />);
  assert.match(markup, /for="invite-email"/);
  assert.match(markup, /aria-invalid="true"/);
  assert.match(markup, /aria-describedby="invite-help invite-email-error"/);
  assert.match(markup, /<p id="invite-email-error"/);
});
