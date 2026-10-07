import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { saveImageForUser, type UploadStoreDb } from "../src/lib/upload-store";

function fakeDb(usedBytes = 0) {
  const calls: { text: string; params?: unknown[] }[] = [];
  const db: UploadStoreDb = {
    async connect() {
      return {
        async query(text: string, params?: unknown[]) {
          calls.push({ text, params });
          if (text.includes("SUM(byte_size)")) return { rows: [{ used: String(usedBytes) }], rowCount: 1 };
          return { rows: [], rowCount: 0 };
        },
        release() {},
      };
    },
  };
  return { db, calls };
}

async function tinyPng() {
  return sharp({ create: { width: 8, height: 8, channels: 3, background: "#336699" } }).png().toBuffer();
}

test("saves a compressed image and records it", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "upload-store-"));
  try {
    const { db, calls } = fakeDb();
    const result = await saveImageForUser(
      "user-1",
      await tinyPng(),
      { mediaType: "image", originalName: "my cover!.png", contentType: "image/png" },
      { db, uploadsDir: dir },
    );
    assert.ok("url" in result);
    assert.match(result.url, /^\/uploads\/user-1\/\d+-[0-9a-f-]+-my_cover_\.\w+$/);
    assert.equal(calls.filter((c) => c.text.startsWith("INSERT INTO upload_assets")).length, 1);
    assert.equal((await readdir(path.join(dir, "user-1"))).length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("refuses when over quota and writes nothing", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "upload-store-"));
  try {
    const { db, calls } = fakeDb(250 * 1024 * 1024);
    const result = await saveImageForUser(
      "user-1",
      await tinyPng(),
      { mediaType: "image", originalName: "a.png", contentType: "image/png" },
      { db, uploadsDir: dir },
    );
    assert.deepEqual(result, { error: "quota", usedBytes: 250 * 1024 * 1024, quotaBytes: 250 * 1024 * 1024 });
    assert.equal(calls.some((c) => c.text.startsWith("INSERT")), false);
    assert.ok(calls.some((c) => c.text === "ROLLBACK"));
    const entries = await readdir(path.join(dir, "user-1")).catch(() => []);
    assert.equal(entries.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("rejects bytes that are not an image", async () => {
  const { db, calls } = fakeDb();
  const result = await saveImageForUser(
    "user-1",
    Buffer.from("not an image at all"),
    { mediaType: "image", originalName: "a.png", contentType: "image/png" },
    { db },
  );
  assert.deepEqual(result, { error: "invalid" });
  assert.equal(calls.length, 0);
});

test('private album files use a separate directory and the same owner quota', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'private-upload-'));
  try {
    const { db, calls } = fakeDb();
    const result = await saveImageForUser('user-1', await tinyPng(),
      { mediaType: 'image', originalName: 'guest-photo.png', contentType: 'image/png' },
      { db, uploadsDir: dir, privateFolder: 'social-private' });
    assert.ok('url' in result);
    assert.match(result.url, /^\/uploads\/user-1\/social-private\//);
    assert.equal((await readdir(path.join(dir, 'user-1', 'social-private'))).length, 1);
    assert.ok(calls.some(c => c.text.includes('SUM(byte_size)')));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
