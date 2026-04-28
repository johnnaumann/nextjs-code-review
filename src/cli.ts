import { Command } from "commander";

import { registerReport } from "./commands/report.js";
import { registerReview } from "./commands/review.js";
import { registerSkills } from "./commands/skills.js";
import { getPackageVersion } from "./core/meta.js";

async function main(): Promise<void> {
  const program = new Command()
    .name("nextjs-code-review")
    .description("Local-LLM code review CLI for Next.js branches")
    .version(getPackageVersion());

  registerReview(program);
  registerSkills(program);
  registerReport(program);

  await program.parseAsync(process.argv);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
