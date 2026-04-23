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

function gitClient(cwd: string): SimpleGit {
  return simpleGit({ baseDir: cwd });
}

export async function detectDefaultRemoteHeadRef(git: SimpleGit): Promise<string | null> {
  try {
    const raw = await git.raw(["symbolic-ref", "refs/remotes/origin/HEAD"]);
    // refs/remotes/origin/main
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

export async function getDiff(cwd: string, mode: DiffMode): Promise<FileDiff[]> {
  const git = gitClient(cwd);

  if (mode.kind === "staged") {
    const namesRaw = await git.raw(["diff", "--name-only", "--staged"]);
    const names = parseNameOnly(namesRaw);
    const out: FileDiff[] = [];
    for (const p of names) {
      const patch = await git.raw(["diff", "--staged", "--", p]);
      out.push({ path: p, patch });
    }
    return out.filter((d) => d.patch.trim().length > 0);
  }

  if (mode.kind === "commit") {
    const namesRaw = await git.raw(["show", "--pretty=format:", "--name-only", mode.sha]);
    const names = parseNameOnly(namesRaw);
    const out: FileDiff[] = [];
    for (const p of names) {
      const patch = await git.raw([
        "show",
        "--pretty=format:",
        mode.sha,
        "--",
        p
      ]);
      out.push({ path: p, patch });
    }
    return out.filter((d) => d.patch.trim().length > 0);
  }

  // branch diff vs base
  const base =
    mode.base ??
    (await detectDefaultRemoteHeadRef(git)) ??
    "origin/main";

  // Ensure base is a ref that exists locally; if not, try origin/master.
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
    throw new Error(
      `Could not resolve base ref. Tried: ${baseCandidates.join(", ")}`
    );
  }

  const namesRaw = await git.raw(["diff", "--name-only", `${chosenBase}...HEAD`]);
  const names = parseNameOnly(namesRaw);

  const out: FileDiff[] = [];
  for (const p of names) {
    // avoid weird path traversal in output path; git should only output repo paths
    const safe = p.split(path.sep).join("/");
    const patch = await git.raw(["diff", `${chosenBase}...HEAD`, "--", safe]);
    out.push({ path: safe, patch });
  }
  return out.filter((d) => d.patch.trim().length > 0);
}

