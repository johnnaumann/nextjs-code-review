export type ReviewSeverity = "info" | "warning" | "error";

export type ReviewFinding = {
  file: string;
  line?: number;
  severity: ReviewSeverity;
  skill: string;
  ruleId?: string;
  message: string;
  suggestion?: string;
};

export type ReviewResult = {
  summary: string;
  findings: ReviewFinding[];
};

