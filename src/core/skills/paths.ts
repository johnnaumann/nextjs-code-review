import path from "node:path";

export function resolveSkillsDir(explicitSkillsDir?: string): string {
  if (explicitSkillsDir && explicitSkillsDir.trim()) return explicitSkillsDir;
  if (process.env.NEXTJS_CODE_REVIEW_SKILLS_DIR?.trim()) {
    return process.env.NEXTJS_CODE_REVIEW_SKILLS_DIR.trim();
  }
  return path.join(process.cwd(), ".code-review", "skills");
}

export function resolveReportsDir(): string {
  return path.join(process.cwd(), ".code-review", "reports");
}

export function resolveCodeReviewDir(): string {
  return path.join(process.cwd(), ".code-review");
}

export function resolveCacheDir(): string {
  return path.join(process.cwd(), ".code-review", "cache");
}

export function resolveSkillsLockPath(skillsDir: string): string {
  return path.join(skillsDir, ".lock.json");
}

