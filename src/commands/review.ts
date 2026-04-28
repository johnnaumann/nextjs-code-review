import type { Command } from "commander";
import ora from "ora";
import { simpleGit } from "simple-git";

import { computeCacheKey, readCacheEntry, writeCacheEntry } from "../core/cache.js";
import { getBranchName, getDiff } from "../core/git.js";
import { getPackageVersion } from "../core/meta.js";
import {
  ollamaChatOnce,
  ollamaHasModel,
  type OllamaChatOptions
} from "../core/ollama.js";
import { buildSkillsBlock } from "../core/prompt/build.js";
import { reviewResultSchema, type ReviewResultSchema } from "../core/prompt/schema.js";
import { buildSystemPrompt, buildUserPrompt } from "../core/prompt/templates.js";
import { summarizeToConsole } from "../core/report/console.js";
import { writeMarkdownReport } from "../core/report/markdown.js";
import { ensureDefaultSkillsInstalled, readSkillsLock } from "../core/skills/fetcher.js";
import { loadSkills } from "../core/skills/loader.js";
import { resolveCacheDir, resolveSkillsDir } from "../core/skills/paths.js";
import { selectRulesForFile } from "../core/skills/selector.js";
import { registerWorkflow } from "../core/workflow/registry.js";

const DEFAULT_MODEL = "qwen2.5-coder:14b";
const DEFAULT_NUM_CTX = 16384;
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_RULES = 12;
const DEFAULT_RETRIES = 1;

export function registerReview(program: Command) {
  registerWorkflow(program, (p) => {
    p.command("review", { isDefault: true })
      .description("Review current branch changes with a local Ollama model")
      .option("--base <ref>", "Base git ref to diff against (default: origin/HEAD)")
      .option("--staged", "Review staged changes only")
      .option("--commit <sha>", "Review a specific commit (git show)")
      .option("--model <name>", "Ollama model name", DEFAULT_MODEL)
      .option("--num-ctx <n>", "Ollama context window in tokens", String(DEFAULT_NUM_CTX))
      .option("--temperature <n>", "Sampling temperature", String(DEFAULT_TEMPERATURE))
      .option(
        "--max-rules <n>",
        "Max rules included in the prompt per file",
        String(DEFAULT_MAX_RULES)
      )
      .option("--skills <names>", "Comma-separated skill names to apply")
      .option("--skills-dir <path>", "Skills directory (default: .code-review/skills)")
      .option("--no-cache", "Disable per-file result cache")
      .option(
        "--retries <n>",
        "Retries on JSON parse / schema failure",
        String(DEFAULT_RETRIES)
      )
      .option("-y, --yes", "Auto-install missing skills without prompting")
      .action(
        async (opts: {
          base?: string;
          staged?: boolean;
          commit?: string;
          model: string;
          numCtx: string;
          temperature: string;
          maxRules: string;
          skills?: string;
          skillsDir?: string;
          cache: boolean;
          retries: string;
          yes?: boolean;
        }) => {
          const cwd = process.cwd();
          const cliVersion = getPackageVersion();

          const numCtx = clampInt(opts.numCtx, 1024, 131072, DEFAULT_NUM_CTX);
          const temperature = clampFloat(opts.temperature, 0, 2, DEFAULT_TEMPERATURE);
          const maxRules = clampInt(opts.maxRules, 1, 100, DEFAULT_MAX_RULES);
          const retries = clampInt(opts.retries, 0, 5, DEFAULT_RETRIES);
          const useCache = opts.cache !== false;

          const skillsDir = resolveSkillsDir(opts.skillsDir);
          let lock = await readSkillsLock(skillsDir);
          if (!lock) {
            if (!opts.yes) {
              p.error(
                `No skills installed at ${skillsDir}\n` +
                  `Run: nextjs-code-review skills install\n` +
                  `Or rerun with: nextjs-code-review review -y`
              );
            }
            const spinner = ora(`Installing default skills into ${skillsDir}...`).start();
            try {
              await ensureDefaultSkillsInstalled(skillsDir);
              spinner.succeed("Skills installed");
              lock = await readSkillsLock(skillsDir);
            } catch (e) {
              spinner.fail("Failed to install skills");
              throw e;
            }
          }

          const wantedSkills =
            opts.skills?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];

          const loadedSkills = await loadSkills(
            skillsDir,
            wantedSkills.length ? wantedSkills : undefined
          );
          if (loadedSkills.length === 0) {
            p.error(`No readable skills found at ${skillsDir}`);
          }

          const model = opts.model;
          const hasModel = await ollamaHasModel(model);
          if (!hasModel) {
            p.error(
              `Ollama model not found: ${model}\n` +
                `Run: ollama pull ${model}\n` +
                `Or pass another model with --model`
            );
          }

          const mode = opts.staged
            ? ({ kind: "staged" } as const)
            : opts.commit
              ? ({ kind: "commit", sha: opts.commit } as const)
              : opts.base
                ? ({ kind: "branch", base: opts.base } as const)
                : ({ kind: "branch" } as const);

          const diffSpinner = ora("Collecting git diff...").start();
          const { diffs, skipped } = await getDiff(cwd, mode);
          diffSpinner.succeed(
            `Collected ${diffs.length} reviewable file(s)` +
              (skipped.length ? ` (skipped ${skipped.length})` : "")
          );
          for (const s of skipped) {
            console.log(`  • skipped ${s.path} (${s.reason})`);
          }

          const skillsLockSha = lock
            ? Object.values(lock.skills)
                .map((e) => e.sha)
                .sort()
                .join(",")
            : undefined;
          const cacheDir = resolveCacheDir();

          const ollamaOptions: OllamaChatOptions = {
            num_ctx: numCtx,
            temperature
          };

          const resultsByFile: Array<{ file: string; result: ReviewResultSchema }> = [];

          for (const d of diffs) {
            const s = ora(`Reviewing ${d.path}...`).start();
            try {
              const selected = selectRulesForFile(
                loadedSkills,
                { filePath: d.path, diff: d.patch },
                { maxRules }
              );
              const skillsBlock = buildSkillsBlock(selected);
              const systemPrompt = buildSystemPrompt(skillsBlock);
              const userPrompt = buildUserPrompt({ filePath: d.path, diff: d.patch });

              const cacheKey = computeCacheKey({
                model,
                num_ctx: numCtx,
                temperature,
                skillsLockSha,
                filePath: d.path,
                patch: d.patch,
                systemPrompt,
                cliVersion
              });

              if (useCache) {
                const cached = await readCacheEntry<ReviewResultSchema>(cacheDir, cacheKey);
                if (cached) {
                  resultsByFile.push({ file: d.path, result: cached });
                  s.succeed(`Reviewed ${d.path} (cached)`);
                  continue;
                }
              }

              const result = await reviewWithRetries({
                model,
                options: ollamaOptions,
                systemPrompt,
                userPrompt,
                retries
              });

              if (useCache) {
                await writeCacheEntry(cacheDir, cacheKey, result);
              }
              resultsByFile.push({ file: d.path, result });
              s.succeed(`Reviewed ${d.path}`);
            } catch (e) {
              s.fail(`Failed reviewing ${d.path}`);
              throw e;
            }
          }

          const git = simpleGit({ baseDir: cwd });
          const branch = await getBranchName(git);
          const reportPath = await writeMarkdownReport({
            branch,
            ...(opts.base ? { base: opts.base } : {}),
            model,
            skillsLock: lock,
            resultsByFile
          });

          summarizeToConsole(reportPath, resultsByFile);
        }
      );
  });
}

async function reviewWithRetries(input: {
  model: string;
  options: OllamaChatOptions;
  systemPrompt: string;
  userPrompt: string;
  retries: number;
}): Promise<ReviewResultSchema> {
  let lastError: unknown;
  let userMessage = input.userPrompt;
  for (let attempt = 0; attempt <= input.retries; attempt++) {
    try {
      const resp = await ollamaChatOnce({
        model: input.model,
        format: "json",
        options: input.options,
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: userMessage }
        ]
      });
      const parsedJson = JSON.parse(resp.message.content);
      return reviewResultSchema.parse(parsedJson);
    } catch (e) {
      lastError = e;
      userMessage =
        `${input.userPrompt}\n\n` +
        `[Previous attempt failed validation: ${stringifyError(e)}.\n` +
        `Reply with VALID JSON ONLY matching the schema in the system prompt. ` +
        `Do not add commentary or markdown fences.]`;
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error(
    `Failed to obtain a valid review after ${input.retries + 1} attempt(s)`
  );
}

function stringifyError(e: unknown): string {
  if (e instanceof Error) return e.message.replace(/\s+/g, " ").slice(0, 400);
  return String(e).slice(0, 400);
}

function clampInt(
  raw: string | number | undefined,
  min: number,
  max: number,
  fallback: number
): number {
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function clampFloat(
  raw: string | number | undefined,
  min: number,
  max: number,
  fallback: number
): number {
  const n = typeof raw === "number" ? raw : Number.parseFloat(String(raw ?? ""));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
