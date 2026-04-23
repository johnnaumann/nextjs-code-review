import type { Command } from "commander";
import { registerWorkflow } from "../core/workflow/registry.js";
import { installSkills, readSkillsLock } from "../core/skills/fetcher.js";
import { resolveSkillsDir } from "../core/skills/paths.js";
import { DEFAULT_SKILLS } from "../core/skills/types.js";

export function registerSkills(program: Command) {
  registerWorkflow(program, (p) => {
    const skills = p.command("skills").description("Manage agent-skills in this project");

    skills
      .command("list")
      .description("List installed skills")
      .option("--skills-dir <path>", "Skills directory (default: .code-review/skills)")
      .action(async (opts: { skillsDir?: string }) => {
        const skillsDir = resolveSkillsDir(opts.skillsDir);
        const lock = await readSkillsLock(skillsDir);
        if (!lock) {
          console.log(`No skills installed at ${skillsDir}`);
          console.log(`Run: nextjs-code-review skills install`);
          return;
        }
        console.log(`Skills source: ${lock.source}`);
        for (const [name, entry] of Object.entries(lock.skills)) {
          console.log(`${name}  sha=${entry.sha}  fetchedAt=${entry.fetchedAt}`);
        }
      });

    skills
      .command("install")
      .description("Install default (or named) skills into .code-review/skills")
      .argument("[names...]", "Skill names from vercel-labs/agent-skills")
      .option("--force", "Overwrite existing installed skills", false)
      .option("--skills-dir <path>", "Skills directory (default: .code-review/skills)")
      .action(
        async (
          names: string[],
          opts: { force: boolean; skillsDir?: string }
        ) => {
          const skillsDir = resolveSkillsDir(opts.skillsDir);
          const installNames = names.length > 0 ? names : [...DEFAULT_SKILLS];
          const lock = await installSkills({
            skillsDir,
            names: installNames,
            force: opts.force
          });
          console.log(`Installed ${installNames.length} skill(s) into ${skillsDir}`);
          console.log(`Pinned at ${Object.values(lock.skills)[0]?.sha ?? lock.source}`);
        }
      );

    skills
      .command("refresh")
      .description("Refresh installed skills to latest main")
      .argument("[names...]", "Skill names to refresh")
      .option("--skills-dir <path>", "Skills directory (default: .code-review/skills)")
      .action(async (names: string[], opts: { skillsDir?: string }) => {
        const skillsDir = resolveSkillsDir(opts.skillsDir);
        const lock = await installSkills({
          skillsDir,
          names: names.length > 0 ? names : [...DEFAULT_SKILLS],
          force: true
        });
        console.log(`Refreshed skills in ${skillsDir} to ${Object.values(lock.skills)[0]?.sha}`);
      });

    skills
      .command("add")
      .description("Install one additional skill by name")
      .argument("<name>", "Skill name")
      .option("--skills-dir <path>", "Skills directory (default: .code-review/skills)")
      .action(async (name: string, opts: { skillsDir?: string }) => {
        const skillsDir = resolveSkillsDir(opts.skillsDir);
        const lock = await installSkills({
          skillsDir,
          names: [name],
          force: false
        });
        console.log(`Installed ${name} into ${skillsDir} pinned at ${lock.skills[name]?.sha}`);
      });
  });
}

