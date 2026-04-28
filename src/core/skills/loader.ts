import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";

export type RuleImpact = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export type LoadedRule = {
  /** Path relative to the skill dir, e.g. "rules/rerender-memo.md". */
  path: string;
  title?: string | undefined;
  impact: RuleImpact;
  tags: string[];
  /** Markdown body with frontmatter stripped. */
  body: string;
};

export type LoadedSkill = {
  name: string;
  description?: string | undefined;
  /** SKILL.md body with frontmatter stripped. */
  skillBody: string;
  rules: LoadedRule[];
};

const RULES_DIRNAME = "rules";

async function listSubdirs(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => path.join(dir, e.name));
}

async function listMarkdownFilesIn(dir: string): Promise<string[]> {
  const out: string[] = [];
  const exists = await stat(dir).catch(() => null);
  if (!exists) return out;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listMarkdownFilesIn(p)));
      continue;
    }
    if (!entry.isFile()) continue;
    const lower = entry.name.toLowerCase();
    if (!lower.endsWith(".md")) continue;
    if (entry.name.startsWith("_")) continue;
    out.push(p);
  }
  return out;
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v).trim().toLowerCase())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

function parseImpact(value: unknown): RuleImpact {
  if (typeof value !== "string") return "UNKNOWN";
  const v = value.trim().toUpperCase();
  if (v === "HIGH" || v === "MEDIUM" || v === "LOW") return v;
  return "UNKNOWN";
}

export async function loadSkillFromDir(skillDir: string): Promise<LoadedSkill> {
  const name = path.basename(skillDir);
  const skillMdPath = path.join(skillDir, "SKILL.md");

  const skillMd = await readFile(skillMdPath, "utf8").catch((e) => {
    throw new Error(`Missing SKILL.md for skill '${name}' at ${skillMdPath}: ${String(e)}`);
  });

  const parsedSkill = matter(skillMd);
  const description =
    typeof parsedSkill.data?.description === "string"
      ? parsedSkill.data.description
      : undefined;

  const rulesDir = path.join(skillDir, RULES_DIRNAME);
  const ruleFilePaths = (await listMarkdownFilesIn(rulesDir)).sort((a, b) =>
    a.localeCompare(b)
  );

  const rules: LoadedRule[] = [];
  for (const p of ruleFilePaths) {
    const raw = await readFile(p, "utf8");
    const parsed = matter(raw);
    const data = (parsed.data ?? {}) as Record<string, unknown>;
    const title = typeof data.title === "string" ? data.title : undefined;

    const rule: LoadedRule = {
      path: path.relative(skillDir, p),
      ...(title !== undefined ? { title } : {}),
      impact: parseImpact(data.impact),
      tags: parseTags(data.tags),
      body: parsed.content.trim()
    };
    rules.push(rule);
  }

  return {
    name,
    ...(description !== undefined ? { description } : {}),
    skillBody: parsedSkill.content.trimEnd(),
    rules
  };
}

export async function loadSkills(skillsDir: string, names?: string[]): Promise<LoadedSkill[]> {
  const exists = await stat(skillsDir).catch(() => null);
  if (!exists) return [];

  const dirs = (await listSubdirs(skillsDir)).sort((a, b) => a.localeCompare(b));
  const filtered =
    names && names.length > 0
      ? dirs.filter((d) => names.includes(path.basename(d)))
      : dirs;

  const loaded: LoadedSkill[] = [];
  for (const dir of filtered) {
    loaded.push(await loadSkillFromDir(dir));
  }
  return loaded;
}
