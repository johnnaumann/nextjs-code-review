export type SkillLockEntry = {
  sha: string;
  fetchedAt: string;
};

export type SkillsLock = {
  source: string;
  skills: Record<string, SkillLockEntry>;
};

export const DEFAULT_SKILLS = [
  "composition-patterns",
  "react-best-practices",
  "web-design-guidelines"
] as const;

