import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";

export type LoadedRule = {
  path: string;
  body: string;
};

export type LoadedSkill = {
  name: string;
  description?: string | undefined;
  skillBody: string;
  rules: LoadedRule[];
};

async function listSubdirs(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => path.join(dir, e.name));
}

async function listMarkdownFilesRecursive(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listMarkdownFilesRecursive(p)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      out.push(p);
    }
  }
  return out;
}

export async function loadSkillFromDir(skillDir: string): Promise<LoadedSkill> {
  const name = path.basename(skillDir);
  const skillMdPath = path.join(skillDir, "SKILL.md");

  const skillMd = await readFile(skillMdPath, "utf8").catch((e) => {
    throw new Error(`Missing SKILL.md for skill '${name}' at ${skillMdPath}: ${String(e)}`);
  });

  const parsed = matter(skillMd);
  const description =
    typeof parsed.data?.description === "string" ? parsed.data.description : undefined;

  const files = await listMarkdownFilesRecursive(skillDir);
  const ruleFiles = files
    .filter((p) => p !== skillMdPath)
    .sort((a, b) => a.localeCompare(b));

  const rules: LoadedRule[] = [];
  for (const p of ruleFiles) {
    const body = await readFile(p, "utf8");
    rules.push({ path: path.relative(skillDir, p), body });
  }

  return {
    name,
    description,
    skillBody: parsed.content.trimEnd(),
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

