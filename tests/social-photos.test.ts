import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { canReadPhoto, readBoundedBody, normalizePhoto, privatePhotoPath } from '../src/lib/social/photos';
test('pending photos are limited to their uploader and event moderators', () => {
  assert.equal(canReadPhoto(false,'a','b',false),false);
  assert.equal(canReadPhoto(false,'a','a',false),true);
  assert.equal(canReadPhoto(false,'a',null,true),true);
  assert.equal(canReadPhoto(true,'a','b',false),true);
});
test('upload stream stops at the byte cap even without content-length', async () => {
  const body = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(12)); c.close(); } });
  const request = new Request('https://example.com',{ method:'POST',body,duplex:'half' } as RequestInit);
  assert.equal(await readBoundedBody(request,10),null);
});
test('photo parser rejects active content and re-encodes supported images', async () => {
  assert.equal(await normalizePhoto(Buffer.from('<svg/>'),'image/svg+xml'),null);
  assert.equal(await normalizePhoto(Buffer.from('wrong'),'image/png'),null);
  const png = await sharp({ create:{ width:8,height:8,channels:3,background:'#fff' } }).png().toBuffer();
  const result = await normalizePhoto(png,'image/png');
  assert.ok(result);
  assert.equal((await sharp(result).metadata()).format,'webp');
  assert.equal((await sharp(result).metadata()).exif,undefined);
});
test('private file resolution refuses public and traversal paths', () => {
  assert.equal(privatePhotoPath('/uploads/../social-private/x.webp'),null);
  assert.equal(privatePhotoPath('/uploads/abc/cover.webp'),null);
  assert.ok(privatePhotoPath('/uploads/00000000-0000-4000-8000-000000000001/social-private/x.webp'));
});
