import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  computeCacheKey,
  listCacheEntries,
  readCacheEntry,
  writeCacheEntry
} from "../src/core/cache.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = path.join(
    os.tmpdir(),
    `nextjs-code-review-cache-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await mkdir(tmpDir, { recursive: true });
});

afterEach(async () => {
  // best-effort cleanup; vitest will exit anyway
});

describe("computeCacheKey", () => {
  it("is deterministic for the same input", () => {
    const a = computeCacheKey({
      model: "qwen2.5-coder:14b",
      num_ctx: 16384,
      temperature: 0.2,
      skillsLockSha: "abc",
      filePath: "src/x.ts",
      patch: "+a",
      systemPrompt: "sys",
      cliVersion: "0.2.0"
    });
    const b = computeCacheKey({
      model: "qwen2.5-coder:14b",
      num_ctx: 16384,
      temperature: 0.2,
      skillsLockSha: "abc",
      filePath: "src/x.ts",
      patch: "+a",
      systemPrompt: "sys",
      cliVersion: "0.2.0"
    });
    expect(a).toBe(b);
  });

  it("changes when any input changes", () => {
    const base = {
      model: "qwen2.5-coder:14b",
      num_ctx: 16384,
      temperature: 0.2,
      skillsLockSha: "abc",
      filePath: "src/x.ts",
      patch: "+a",
      systemPrompt: "sys",
      cliVersion: "0.2.0"
    };
    const k0 = computeCacheKey(base);
    expect(computeCacheKey({ ...base, model: "other" })).not.toBe(k0);
    expect(computeCacheKey({ ...base, num_ctx: 8192 })).not.toBe(k0);
    expect(computeCacheKey({ ...base, temperature: 0.1 })).not.toBe(k0);
    expect(computeCacheKey({ ...base, skillsLockSha: "xyz" })).not.toBe(k0);
    expect(computeCacheKey({ ...base, filePath: "src/y.ts" })).not.toBe(k0);
    expect(computeCacheKey({ ...base, patch: "+b" })).not.toBe(k0);
    expect(computeCacheKey({ ...base, systemPrompt: "other" })).not.toBe(k0);
    expect(computeCacheKey({ ...base, cliVersion: "0.3.0" })).not.toBe(k0);
  });
});

describe("cache write/read/list", () => {
  it("round-trips an entry and returns it from list", async () => {
    const key = "abc123";
    await writeCacheEntry({
      cacheDir: tmpDir,
      key,
      filePath: "app/page.tsx",
      model: "qwen2.5-coder:7b",
      value: { summary: "ok", findings: [] }
    });

    const got = await readCacheEntry<{ summary: string; findings: unknown[] }>(
      tmpDir,
      key
    );
    expect(got?.filePath).toBe("app/page.tsx");
    expect(got?.model).toBe("qwen2.5-coder:7b");
    expect(got?.value.summary).toBe("ok");

    const all = await listCacheEntries<{ summary: string; findings: unknown[] }>(tmpDir);
    expect(all).toHaveLength(1);
    expect(all[0]?.key).toBe(key);
  });

  it("listCacheEntries skips non-json and malformed files", async () => {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(path.join(tmpDir, "good.json"), JSON.stringify({
      key: "k1",
      createdAt: new Date().toISOString(),
      filePath: "x.ts",
      model: "m",
      value: { summary: "s", findings: [] }
    }), "utf8");
    await writeFile(path.join(tmpDir, "bad.json"), "{not valid json", "utf8");
    await writeFile(path.join(tmpDir, "ignore.txt"), "irrelevant", "utf8");

    const all = await listCacheEntries(tmpDir);
    expect(all).toHaveLength(1);
    expect(all[0]?.filePath).toBe("x.ts");
  });
});
