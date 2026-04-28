import type { LoadedRule, LoadedSkill } from "../skills/loader.js";

export type SkillRenderInput = {
  skill: LoadedSkill;
  rules: LoadedRule[];
};

function renderRule(skillName: string, rule: LoadedRule): string {
  const parts: string[] = [];
  const impactSuffix = rule.impact !== "UNKNOWN" ? ` [${rule.impact}]` : "";
  parts.push(`--- RULE: ${skillName}/${rule.path}${impactSuffix} ---`);
  if (rule.title) parts.push(`Title: ${rule.title}`);
  if (rule.tags.length > 0) parts.push(`Tags: ${rule.tags.join(", ")}`);
  parts.push("");
  parts.push(rule.body);
  parts.push("");
  return parts.join("\n");
}

function renderSkill(input: SkillRenderInput): string {
  const { skill, rules } = input;
  const parts: string[] = [];
  parts.push(`--- SKILL: ${skill.name} ---`);
  if (skill.description) parts.push(`Description: ${skill.description}`);
  parts.push("");
  parts.push(skill.skillBody);
  parts.push("");
  for (const rule of rules) parts.push(renderRule(skill.name, rule));
  return parts.join("\n");
}

export function buildSkillsBlock(skills: SkillRenderInput[]): string {
  return skills.map(renderSkill).join("\n");
}
