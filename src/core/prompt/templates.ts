export function buildSystemPrompt(skillsBlock: string): string {
  return [
    "You are a senior software engineer performing a focused code review on a single file's diff.",
    "Apply ONLY the rules and guidance contained in the provided skills below. Do not invent rules.",
    "Be specific, pragmatic, and actionable. Quote the offending line where helpful.",
    "If a skill's rules don't apply to the diff, do not raise findings for that skill.",
    "If the diff doesn't introduce any issues, return an empty findings array.",
    "",
    "Output ONLY a single JSON object that matches this TypeScript shape — no prose, no markdown fences:",
    "{",
    '  "summary": string,',
    '  "findings": Array<{',
    '    "file": string,',
    '    "line"?: number,',
    '    "severity": "info" | "warning" | "error",',
    '    "skill": string,',
    '    "ruleId"?: string,',
    '    "message": string,',
    '    "suggestion"?: string',
    "  }>",
    "}",
    "",
    skillsBlock
  ].join("\n");
}

export function buildUserPrompt(params: {
  filePath: string;
  diff: string;
}): string {
  return [
    `File: ${params.filePath}`,
    "",
    "Unified diff (review only the additions and modifications, not unchanged context):",
    "",
    params.diff.trim()
  ].join("\n");
}
