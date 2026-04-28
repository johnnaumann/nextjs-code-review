import type { Command } from "commander";
import { simpleGit } from "simple-git";

import { listCacheEntries } from "../core/cache.js";
import { getBranchName } from "../core/git.js";
import type { ReviewResultSchema } from "../core/prompt/schema.js";
import {
  defaultReportPath,
  writeMarkdownReportToPath
} from "../core/report/markdown.js";
import { readSkillsLock } from "../core/skills/fetcher.js";
import { resolveCacheDir, resolveSkillsDir } from "../core/skills/paths.js";
import { registerWorkflow } from "../core/workflow/registry.js";

export function registerReport(program: Command) {
  registerWorkflow(program, (p) => {
    p.command("report")
      .description(
        "Rebuild a markdown report from cached review results " +
          "(useful if a previous run was killed before completion)"
      )
      .option("--out <path>", "Override the output path")
      .option(
        "--model <name>",
        "Only include cache entries that were produced by this Ollama model"
      )
      .option(
        "--include <glob>",
        "Comma-separated path prefixes to include (e.g. 'app/,src/')"
      )
      .option("--skills-dir <path>", "Skills directory (default: .code-review/skills)")
      .action(
        async (opts: {
          out?: string;
          model?: string;
          include?: string;
          skillsDir?: string;
        }) => {
          const cwd = process.cwd();
          const cacheDir = resolveCacheDir();

          const entries = await listCacheEntries<ReviewResultSchema>(cacheDir);
          if (entries.length === 0) {
            p.error(
              `No cache entries found at ${cacheDir}\n` +
                `Run \`nextjs-code-review review\` first.`
            );
          }

          const includePrefixes =
            opts.include?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];

          const filtered = entries.filter((e) => {
            if (opts.model && e.model !== opts.model) return false;
            if (
              includePrefixes.length > 0 &&
              !includePrefixes.some((prefix) => e.filePath.startsWith(prefix))
            ) {
              return false;
            }
            return true;
          });

          if (filtered.length === 0) {
            p.error(`No cache entries matched the given filters.`);
          }

          // Stable order: oldest cache entry first per file path; multiple
          // entries for the same path keep only the most recent one.
          const byPath = new Map<string, (typeof filtered)[number]>();
          for (const e of filtered) {
            const existing = byPath.get(e.filePath);
            if (!existing || e.createdAt > existing.createdAt) {
              byPath.set(e.filePath, e);
            }
          }
          const ordered = Array.from(byPath.values()).sort((a, b) =>
            a.filePath.localeCompare(b.filePath)
          );

          const resultsByFile = ordered.map((e) => ({
            file: e.filePath,
            result: e.value
          }));

          const git = simpleGit({ baseDir: cwd });
          const branch = await getBranchName(git).catch(() => "unknown-branch");

          const skillsDir = resolveSkillsDir(opts.skillsDir);
          const lock = await readSkillsLock(skillsDir);

          // Determine model header. If we filtered to a specific model, use
          // that. Otherwise use the most common one in the included entries.
          const modelHeader =
            opts.model ?? mostCommonModel(ordered.map((e) => e.model)) ?? "(mixed)";

          const reportPath = opts.out ?? defaultReportPath(branch);
          await writeMarkdownReportToPath(reportPath, {
            branch,
            model: modelHeader,
            skillsLock: lock,
            resultsByFile,
            totalFiles: resultsByFile.length,
            inProgress: false
          });

          console.log(
            `Wrote report from ${ordered.length} cache entr${
              ordered.length === 1 ? "y" : "ies"
            } to ${reportPath}`
          );
        }
      );
  });
}

function mostCommonModel(models: string[]): string | undefined {
  if (models.length === 0) return undefined;
  const counts = new Map<string, number>();
  for (const m of models) counts.set(m, (counts.get(m) ?? 0) + 1);
  let best: string | undefined;
  let bestCount = -1;
  for (const [m, c] of counts) {
    if (c > bestCount) {
      best = m;
      bestCount = c;
    }
  }
  return best;
}
