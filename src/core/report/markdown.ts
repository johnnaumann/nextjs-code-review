import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ReviewResultSchema } from "../prompt/schema.js";
import type { SkillsLock } from "../skills/types.js";
import { resolveReportsDir } from "../skills/paths.js";

function slugBranch(branch: string): string {
  return branch.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours()
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export type WriteReportParams = {
  branch: string;
  base?: string;
  model: string;
  skillsLock: SkillsLock | null;
  resultsByFile: Array<{ file: string; result: ReviewResultSchema }>;
};

export async function writeMarkdownReport(params: WriteReportParams): Promise<string> {
  const dir = resolveReportsDir();
  await mkdir(dir, { recursive: true });

  const fileName = `${slugBranch(params.branch)}-${timestamp()}.md`;
  const outPath = path.join(dir, fileName);

  const lines: string[] = [];
  lines.push(`# Code review report`);
  lines.push("");
  lines.push(`- **branch**: \`${params.branch}\``);
  if (params.base) lines.push(`- **base**: \`${params.base}\``);
  lines.push(`- **model**: \`${params.model}\``);

  if (params.skillsLock) {
    lines.push(`- **skills source**: \`${params.skillsLock.source}\``);
    lines.push(`- **skills (pinned)**:`);
    for (const [name, entry] of Object.entries(params.skillsLock.skills)) {
      lines.push(`  - \`${name}\` @ \`${entry.sha}\``);
    }
  } else {
    lines.push(`- **skills**: (no lock found)`);
  }

  lines.push("");
  lines.push(`## Findings`);
  lines.push("");

  for (const { file, result } of params.resultsByFile) {
    lines.push(`### ${file}`);
    lines.push("");
    lines.push(result.summary.trim() ? result.summary.trim() : "_No summary provided._");
    lines.push("");

    if (result.findings.length === 0) {
      lines.push(`- _No findings._`);
      lines.push("");
      continue;
    }

    for (const f of result.findings) {
      const loc = f.line ? `:${f.line}` : "";
      const rule = f.ruleId ? ` (${f.ruleId})` : "";
      lines.push(
        `- **${f.severity.toUpperCase()}** \`${f.file}${loc}\` — **${f.skill}**${rule}: ${f.message}`
      );
      if (f.suggestion) {
        lines.push(`  - Suggestion: ${f.suggestion}`);
      }
    }
    lines.push("");
  }

  lines.push(`## Raw JSON`);
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(params.resultsByFile, null, 2));
  lines.push("```");
  lines.push("");

  await writeFile(outPath, lines.join("\n"), "utf8");
  return outPath;
}

