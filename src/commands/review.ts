import type { Command } from "commander";
import { registerWorkflow } from "../core/workflow/registry.js";
import ora from "ora";

import { getDiff } from "../core/git.js";
import { ollamaChatOnce, ollamaHasModel } from "../core/ollama.js";
import { buildSkillsBlock } from "../core/prompt/build.js";
import { reviewResultSchema } from "../core/prompt/schema.js";
import { buildSystemPrompt, buildUserPrompt } from "../core/prompt/templates.js";
import { writeMarkdownReport } from "../core/report/markdown.js";
import { summarizeToConsole } from "../core/report/console.js";
import { loadSkills } from "../core/skills/loader.js";
import { ensureDefaultSkillsInstalled, readSkillsLock } from "../core/skills/fetcher.js";
import { resolveSkillsDir } from "../core/skills/paths.js";
import { getBranchName } from "../core/git.js";
import { simpleGit } from "simple-git";

export function registerReview(program: Command) {
  registerWorkflow(program, (p) => {
    p.command("review", { isDefault: true })
      .description("Review current branch changes with a local Ollama model")
      .option("--base <ref>", "Base git ref to diff against (default: origin/HEAD)")
      .option("--staged", "Review staged changes only")
      .option("--commit <sha>", "Review a specific commit (git show)")
      .option("--model <name>", "Ollama model name", "qwen2.5-coder:7b")
      .option("--skills <names>", "Comma-separated skill names to apply")
      .option("--skills-dir <path>", "Skills directory (default: .code-review/skills)")
      .option("-y, --yes", "Auto-install missing skills without prompting")
      .action(async (opts: {
        base?: string;
        staged?: boolean;
        commit?: string;
        model: string;
        skills?: string;
        skillsDir?: string;
        yes?: boolean;
      }) => {
        const cwd = process.cwd();

        const skillsDir = resolveSkillsDir(opts.skillsDir);
        const lock = await readSkillsLock(skillsDir);
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
          } catch (e) {
            spinner.fail("Failed to install skills");
            throw e;
          }
        }

        const wantedSkills =
          opts.skills?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];

        const loadedSkills = await loadSkills(skillsDir, wantedSkills.length ? wantedSkills : undefined);
        if (loadedSkills.length === 0) {
          p.error(`No readable skills found at ${skillsDir}`);
        }

        const skillsBlock = buildSkillsBlock(loadedSkills);
        const systemPrompt = buildSystemPrompt(skillsBlock);

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
        const diffs = await getDiff(cwd, mode);
        diffSpinner.succeed(`Collected ${diffs.length} changed file(s)`);

        const resultsByFile: Array<{ file: string; result: ReturnType<typeof reviewResultSchema.parse> }> =
          [];

        for (const d of diffs) {
          const s = ora(`Reviewing ${d.path}...`).start();
          try {
            const userPrompt = buildUserPrompt({ filePath: d.path, diff: d.patch });
            const resp = await ollamaChatOnce({
              model,
              format: "json",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
              ]
            });

            const parsedJson = JSON.parse(resp.message.content);
            const result = reviewResultSchema.parse(parsedJson);
            resultsByFile.push({ file: d.path, result });
            s.succeed(`Reviewed ${d.path}`);
          } catch (e) {
            s.fail(`Failed reviewing ${d.path}`);
            throw e;
          }
        }

        const git = simpleGit({ baseDir: cwd });
        const branch = await getBranchName(git);
        const finalLock = await readSkillsLock(skillsDir);
        const reportPath = await writeMarkdownReport({
          branch,
          ...(opts.base ? { base: opts.base } : {}),
          model,
          skillsLock: finalLock,
          resultsByFile
        });

        summarizeToConsole(reportPath, resultsByFile);
      });
  });
}

