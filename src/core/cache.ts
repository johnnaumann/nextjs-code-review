import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type CacheEntry<T> = {
  key: string;
  createdAt: string;
  filePath: string;
  model: string;
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

export async function readCacheEntry<T>(
  cacheDir: string,
  key: string
): Promise<CacheEntry<T> | null> {
  try {
    const raw = await readFile(path.join(cacheDir, `${key}.json`), "utf8");
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

export type WriteCacheEntryParams<T> = {
  cacheDir: string;
  key: string;
  filePath: string;
  model: string;
  value: T;
};

export async function writeCacheEntry<T>(params: WriteCacheEntryParams<T>): Promise<void> {
  await mkdir(params.cacheDir, { recursive: true });
  const entry: CacheEntry<T> = {
    key: params.key,
    createdAt: new Date().toISOString(),
    filePath: params.filePath,
    model: params.model,
    value: params.value
  };
  await writeFile(
    path.join(params.cacheDir, `${params.key}.json`),
    JSON.stringify(entry, null, 2) + "\n",
    "utf8"
  );
}

/**
 * List all valid cache entries on disk. Skips files that don't parse,
 * lack the expected shape, or aren't `.json`.
 */
export async function listCacheEntries<T>(cacheDir: string): Promise<CacheEntry<T>[]> {
  let names: string[];
  try {
    names = await readdir(cacheDir);
  } catch {
    return [];
  }

  const out: CacheEntry<T>[] = [];
  for (const name of names) {
    if (!name.toLowerCase().endsWith(".json")) continue;
    try {
      const raw = await readFile(path.join(cacheDir, name), "utf8");
      const parsed = JSON.parse(raw) as CacheEntry<T>;
      if (
        typeof parsed?.key === "string" &&
        typeof parsed?.filePath === "string" &&
        parsed.value !== undefined
      ) {
        out.push(parsed);
      }
    } catch {
      // ignore unreadable / partial files
    }
  }
  return out;
}
