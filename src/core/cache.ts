import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type CacheEntry<T> = {
  key: string;
  createdAt: string;
  value: T;
};

export type CacheKeyInput = {
  model: string;
  num_ctx: number;
  temperature: number;
  skillsLockSha?: string | undefined;
  filePath: string;
  patch: string;
  systemPrompt: string;
  cliVersion: string;
};

const CACHE_VERSION = "v1";

export function computeCacheKey(input: CacheKeyInput): string {
  const h = createHash("sha256");
  h.update(`nextjs-code-review:${CACHE_VERSION}\n`);
  h.update(`model=${input.model}\n`);
  h.update(`num_ctx=${input.num_ctx}\n`);
  h.update(`temperature=${input.temperature}\n`);
  h.update(`skillsLockSha=${input.skillsLockSha ?? ""}\n`);
  h.update(`cliVersion=${input.cliVersion}\n`);
  h.update(`filePath=${input.filePath}\n`);
  h.update("---system---\n");
  h.update(input.systemPrompt);
  h.update("\n---patch---\n");
  h.update(input.patch);
  return h.digest("hex");
}

export async function readCacheEntry<T>(cacheDir: string, key: string): Promise<T | null> {
  try {
    const raw = await readFile(path.join(cacheDir, `${key}.json`), "utf8");
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    return parsed.value ?? null;
  } catch {
    return null;
  }
}

export async function writeCacheEntry<T>(
  cacheDir: string,
  key: string,
  value: T
): Promise<void> {
  await mkdir(cacheDir, { recursive: true });
  const entry: CacheEntry<T> = {
    key,
    createdAt: new Date().toISOString(),
    value
  };
  await writeFile(
    path.join(cacheDir, `${key}.json`),
    JSON.stringify(entry, null, 2) + "\n",
    "utf8"
  );
}
