import path from "node:path";

import { simpleGit, type SimpleGit } from "simple-git";

export type DiffMode =
  | { kind: "branch"; base?: string }
  | { kind: "staged" }
  | { kind: "commit"; sha: string };

export type FileDiff = {
  path: string;
  patch: string;
};

export type SkippedDiff = {
  path: string;
  reason: "empty" | "generated" | "trivial";
};

export type DiffResult = {
  diffs: FileDiff[];
  skipped: SkippedDiff[];
};

const GENERATED_PATTERNS: ReadonlyArray<RegExp> = [
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /(^|\/)\.next\//,
  /(^|\/)out\//,
  /(^|\/)coverage\//,
  /(^|\/)src\/gen\//,
  /(^|\/)__generated__\//,
  /\.generated\.[a-zA-Z]+$/,
  /\.min\.(js|css)$/,
  /\.lock$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)package-lock\.json$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)bun\.lockb?$/,
  /\.snap$/
];

const BINARY_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".ico",
  ".pdf",
  ".zip",
  ".gz",
  ".tgz",
  ".tar",
  ".bz2",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp3",
  ".mp4",
  ".webm",
  ".mov",
  ".wasm"
]);

export function isGeneratedPath(p: string): boolean {
  if (BINARY_EXTS.has(path.extname(p).toLowerCase())) return true;
  return GENERATED_PATTERNS.some((re) => re.test(p));
}

/** Concatenate the added-line bodies in a unified diff (excluding the +++ header). */
export function patchAddedBody(patch: string): string {
  const lines = patch.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (line.startsWith("+++ ")) continue;
    if (line.startsWith("+")) out.push(line.slice(1));
  }
  return out.join("\n");
}

/**
 * A patch is "trivial" if its added body has effectively no semantic content,
 * e.g. an empty new barrel file, whitespace-only addition, or pure deletions.
 */
export function isLikelyTrivialPatch(patch: string): boolean {
  const added = patchAddedBody(patch);
  const stripped = added.replace(/\s+/g, "");
  if (stripped.length === 0) return true;
  if (/^new file mode/m.test(patch) && stripped.length < 20) return true;
  return false;
}

function gitClient(cwd: string): SimpleGit {
  return simpleGit({ baseDir: cwd });
}

export async function detectDefaultRemoteHeadRef(git: SimpleGit): Promise<string | null> {
  try {
    const raw = await git.raw(["symbolic-ref", "refs/remotes/origin/HEAD"]);
    const ref = raw.trim().replace(/^refs\/remotes\//, "");
    return ref || null;
  } catch {
    return null;
  }
}

export async function getBranchName(git: SimpleGit): Promise<string> {
  const info = await git.branch();
  return info.current || "unknown-branch";
}

function parseNameOnly(raw: string): string[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export function parseNameOnlyLines(raw: string): string[] {
  return parseNameOnly(raw);
}

function classify(file: FileDiff): SkippedDiff["reason"] | null {
  if (file.patch.trim().length === 0) return "empty";
  if (isGeneratedPath(file.path)) return "generated";
  if (isLikelyTrivialPatch(file.patch)) return "trivial";
  return null;
}

function partition(files: FileDiff[]): DiffResult {
  const diffs: FileDiff[] = [];
  const skipped: SkippedDiff[] = [];
  for (const f of files) {
    const reason = classify(f);
    if (reason) {
      skipped.push({ path: f.path, reason });
    } else {
      diffs.push(f);
    }
  }
  return { diffs, skipped };
}

export async function getDiff(cwd: string, mode: DiffMode): Promise<DiffResult> {
  const git = gitClient(cwd);

  if (mode.kind === "staged") {
    const namesRaw = await git.raw(["diff", "--name-only", "--staged"]);
    const names = parseNameOnly(namesRaw);
    const out: FileDiff[] = [];
    for (const p of names) {
      const patch = await git.raw(["diff", "--staged", "--", p]);
      out.push({ path: p, patch });
    }
    return partition(out);
  }

  if (mode.kind === "commit") {
    const namesRaw = await git.raw(["show", "--pretty=format:", "--name-only", mode.sha]);
    const names = parseNameOnly(namesRaw);
    const out: FileDiff[] = [];
    for (const p of names) {
      const patch = await git.raw(["show", "--pretty=format:", mode.sha, "--", p]);
      out.push({ path: p, patch });
    }
    return partition(out);
  }

  // branch diff vs base
  const base = mode.base ?? (await detectDefaultRemoteHeadRef(git)) ?? "origin/main";

  const baseCandidates = [base, "origin/main", "origin/master"];
  let chosenBase: string | null = null;
  for (const candidate of baseCandidates) {
    try {
      await git.raw(["rev-parse", "--verify", candidate]);
      chosenBase = candidate;
      break;
    } catch {
      // continue
    }
  }
  if (!chosenBase) {
    throw new Error(`Could not resolve base ref. Tried: ${baseCandidates.join(", ")}`);
  }

  const namesRaw = await git.raw(["diff", "--name-only", `${chosenBase}...HEAD`]);
  const names = parseNameOnly(namesRaw);

  const out: FileDiff[] = [];
  for (const p of names) {
    const safe = p.split(path.sep).join("/");
    const patch = await git.raw(["diff", `${chosenBase}...HEAD`, "--", safe]);
    out.push({ path: safe, patch });
  }
  return partition(out);
}
