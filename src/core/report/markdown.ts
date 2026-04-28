import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ReviewResultSchema } from "../prompt/schema.js";
import type { SkillsLock } from "../skills/types.js";
import { resolveReportsDir } from "../skills/paths.js";

function slugBranch(branch: string): string {
  return branch.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
}

export function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours()
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export type ReportFileResult = { file: string; result: ReviewResultSchema };

export type BuildReportParams = {
  branch: string;
  base?: string;
  model: string;
  skillsLock: SkillsLock | null;
  resultsByFile: ReportFileResult[];
  /** Optional: total number of files originally planned for the run, for progress headers. */
  totalFiles?: number;
  /** Optional: marker to indicate this is a partial / in-flight report. */
  inProgress?: boolean;
};

export function buildMarkdownReport(params: BuildReportParams): string {
  const lines: string[] = [];
  lines.push(`# Code review report${params.inProgress ? " (in progress)" : ""}`);
  lines.push("");
  lines.push(`- **branch**: \`${params.branch}\``);
  if (params.base) lines.push(`- **base**: \`${params.base}\``);
  lines.push(`- **model**: \`${params.model}\``);

  if (typeof params.totalFiles === "number") {
    lines.push(
      `- **progress**: ${params.resultsByFile.length} / ${params.totalFiles} file(s) reviewed`
    );
  }

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

  if (params.resultsByFile.length === 0) {
    lines.push("_No files reviewed yet._");
    lines.push("");
  }

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

  return lines.join("\n");
}

export function defaultReportPath(branch: string, ts = timestamp()): string {
  return path.join(resolveReportsDir(), `${slugBranch(branch)}-${ts}.md`);
}

/** Write a report to a specific path, creating parent dirs as needed. */
export async function writeMarkdownReportToPath(
  reportPath: string,
  params: BuildReportParams
): Promise<string> {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, buildMarkdownReport(params), "utf8");
  return reportPath;
}

/**
 * Backward-compatible wrapper: picks a fresh `<branch>-<timestamp>.md` path
 * inside `.code-review/reports/` and writes the report there.
 */
export async function writeMarkdownReport(params: BuildReportParams): Promise<string> {
  const reportPath = defaultReportPath(params.branch);
  return writeMarkdownReportToPath(reportPath, params);
}
