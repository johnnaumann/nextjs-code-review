import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadSkillFromDir } from "../src/core/skills/loader.js";

describe("loadSkillFromDir", () => {
  it("loads SKILL.md and rule markdown", async () => {
    const tmp = await mkdir(path.join(os.tmpdir(), "nextjs-code-review-"), {
      recursive: true
    }).then(() => path.join(os.tmpdir(), `nextjs-code-review-${Date.now()}`));

    const skillDir = path.join(tmp, "react-best-practices");
    await mkdir(path.join(skillDir, "rules"), { recursive: true });

    await writeFile(
      path.join(skillDir, "SKILL.md"),
      `---\nname: test\ndescription: hello\n---\n\n# Skill Body\n`,
      "utf8"
    );
    await writeFile(path.join(skillDir, "rules", "a.md"), `# Rule A\n`, "utf8");

    const loaded = await loadSkillFromDir(skillDir);
    expect(loaded.name).toBe("react-best-practices");
    expect(loaded.description).toBe("hello");
    expect(loaded.rules).toHaveLength(1);
    expect(loaded.rules[0]?.path).toBe(path.join("rules", "a.md"));
  });
});

