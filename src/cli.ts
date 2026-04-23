import { Command } from "commander";
import { registerReview } from "./commands/review.js";
import { registerSkills } from "./commands/skills.js";
import { getPackageVersion } from "./core/meta.js";

const program = new Command()
  .name("nextjs-code-review")
  .description("Local-LLM code review CLI for Next.js branches")
  .version(await getPackageVersion());

registerReview(program);
registerSkills(program);

await program.parseAsync(process.argv);

