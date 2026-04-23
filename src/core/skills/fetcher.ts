import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { SkillsLock } from "./types.js";
import { DEFAULT_SKILLS } from "./types.js";
import { resolveSkillsLockPath } from "./paths.js";

type GitTreeItem = {
  path: string;
  mode: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  size?: number;
  url: string;
};

type GitTreeResponse = {
  sha: string;
  truncated: boolean;
  tree: GitTreeItem[];
};

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json"
  };
  if (process.env.GITHUB_TOKEN?.trim()) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN.trim()}`;
  }
  return headers;
}

export async function fetchSkillsTree(): Promise<GitTreeResponse> {
  const res = await fetch(
    "https://api.github.com/repos/vercel-labs/agent-skills/git/trees/main?recursive=1",
    { headers: githubHeaders() }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Failed to fetch agent-skills tree: ${res.status} ${res.statusText}\n${body}`
    );
  }
  return (await res.json()) as GitTreeResponse;
}

function isSkillPathFor(name: string, p: string): boolean {
  return p === `skills/${name}` || p.startsWith(`skills/${name}/`);
}

function toRawUrl(commitSha: string, filePath: string): string {
  return `https://raw.githubusercontent.com/vercel-labs/agent-skills/${commitSha}/${filePath}`;
}

async function downloadText(url: string): Promise<string> {
  const res = await fetch(url, { headers: githubHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to download ${url}: ${res.status}\n${body}`);
  }
  return await res.text();
}

export async function readSkillsLock(skillsDir: string): Promise<SkillsLock | null> {
  try {
    const raw = await readFile(resolveSkillsLockPath(skillsDir), "utf8");
    return JSON.parse(raw) as SkillsLock;
  } catch {
    return null;
  }
}

export async function writeSkillsLock(skillsDir: string, lock: SkillsLock) {
  await mkdir(skillsDir, { recursive: true });
  await writeFile(resolveSkillsLockPath(skillsDir), JSON.stringify(lock, null, 2) + "\n", "utf8");
}

export type InstallSkillsOptions = {
  skillsDir: string;
  names?: string[];
  force?: boolean;
};

export async function installSkills(opts: InstallSkillsOptions): Promise<SkillsLock> {
  if (process.env.NEXTJS_CODE_REVIEW_OFFLINE === "1") {
    throw new Error(
      "Offline mode enabled (NEXTJS_CODE_REVIEW_OFFLINE=1). Skills are not installed.\n" +
        "Run without offline mode, or commit .code-review/skills into your repo."
    );
  }

  const names =
    opts.names && opts.names.length > 0 ? opts.names : [...DEFAULT_SKILLS];

  const tree = await fetchSkillsTree();
  const commitSha = tree.sha;

  const relevant = tree.tree.filter(
    (item) =>
      item.type === "blob" && names.some((name) => isSkillPathFor(name, item.path))
  );

  const lock: SkillsLock = {
    source: "github.com/vercel-labs/agent-skills",
    skills: {}
  };

  // Ensure a clean install per-skill when force is set.
  for (const name of names) {
    const targetDir = path.join(opts.skillsDir, name);
    if (opts.force) {
      await rm(targetDir, { recursive: true, force: true });
    }
    await mkdir(targetDir, { recursive: true });
  }

  for (const item of relevant) {
    const rel = item.path.replace(/^skills\//, "");
    const outPath = path.join(opts.skillsDir, rel);
    await mkdir(path.dirname(outPath), { recursive: true });
    const body = await downloadText(toRawUrl(commitSha, item.path));
    await writeFile(outPath, body, "utf8");
  }

  const fetchedAt = new Date().toISOString();
  for (const name of names) {
    lock.skills[name] = { sha: commitSha, fetchedAt };
  }

  await writeSkillsLock(opts.skillsDir, lock);
  return lock;
}

export async function ensureDefaultSkillsInstalled(skillsDir: string): Promise<{
  installed: boolean;
  lock: SkillsLock | null;
}> {
  const lock = await readSkillsLock(skillsDir);
  if (lock) return { installed: true, lock };

  await installSkills({ skillsDir, names: [...DEFAULT_SKILLS] });
  return { installed: true, lock: await readSkillsLock(skillsDir) };
}

