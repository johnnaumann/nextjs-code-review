import type { LoadedSkill } from "../skills/loader.js";

function renderSkill(skill: LoadedSkill): string {
  const parts: string[] = [];
  parts.push(`--- SKILL: ${skill.name} ---`);
  if (skill.description) parts.push(`Description: ${skill.description}`);
  parts.push("");
  parts.push(skill.skillBody);
  parts.push("");
  for (const rule of skill.rules) {
    parts.push(`--- RULE: ${skill.name}/${rule.path} ---`);
    parts.push(rule.body);
    parts.push("");
  }
  return parts.join("\n");
}

export function buildSkillsBlock(skills: LoadedSkill[]): string {
  return skills.map(renderSkill).join("\n");
}

