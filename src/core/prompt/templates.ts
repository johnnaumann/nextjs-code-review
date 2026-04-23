export function buildSystemPrompt(skillsBlock: string): string {
  return [
    "You are a senior software engineer performing a code review.",
    "Apply ONLY the rules and guidance contained in the provided skills.",
    "Be specific, pragmatic, and actionable.",
    "",
    "Return ONLY valid JSON matching this TypeScript shape:",
    "{ summary: string, findings: Array<{ file: string, line?: number, severity: 'info'|'warning'|'error', skill: string, ruleId?: string, message: string, suggestion?: string }> }",
    "",
    skillsBlock
  ].join("\n");
}

export function buildUserPrompt(params: {
  filePath: string;
  diff: string;
}): string {
  return [
    `Review this diff for file: ${params.filePath}`,
    "",
    params.diff
  ].join("\n");
}

