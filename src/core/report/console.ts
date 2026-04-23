import chalk from "chalk";

import type { ReviewResultSchema } from "../prompt/schema.js";

export function summarizeToConsole(
  reportPath: string,
  resultsByFile: Array<{ file: string; result: ReviewResultSchema }>
) {
  let errors = 0;
  let warnings = 0;
  let infos = 0;

  for (const { result } of resultsByFile) {
    for (const f of result.findings) {
      if (f.severity === "error") errors++;
      else if (f.severity === "warning") warnings++;
      else infos++;
    }
  }

  const parts = [
    errors ? chalk.red(`errors=${errors}`) : `errors=${errors}`,
    warnings ? chalk.yellow(`warnings=${warnings}`) : `warnings=${warnings}`,
    infos ? chalk.gray(`info=${infos}`) : `info=${infos}`
  ];

  console.log(`Review complete: ${parts.join("  ")}`);
  console.log(`Report written to ${chalk.cyan(reportPath)}`);
}

