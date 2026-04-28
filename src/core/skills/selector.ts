import path from "node:path";

import type { LoadedRule, LoadedSkill } from "./loader.js";

export type SelectionInput = {
  filePath: string;
  diff: string;
};

export type RuleSelectionOptions = {
  /** Hard cap on number of rules included in the prompt for one file. */
  maxRules?: number;
};

export type SelectedSkillRules = {
  skill: LoadedSkill;
  rules: LoadedRule[];
};

const DEFAULT_MAX_RULES = 12;

const REACT_EXTS = new Set([".tsx", ".jsx"]);
const JS_EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts"
]);

const FILE_TYPE_TAGS: Record<string, ReadonlyArray<string>> = {
  ".tsx": ["react", "rendering", "rerender", "components", "hooks", "client", "rsc"],
  ".jsx": ["react", "rendering", "rerender", "components", "hooks"],
  ".ts": ["javascript", "async", "server", "bundle"],
  ".js": ["javascript", "async", "bundle"],
  ".css": ["css", "rendering", "performance"],
  ".scss": ["css", "rendering", "performance"]
};

const KEYWORD_TAG_HITS: ReadonlyArray<{ pattern: RegExp; tags: string[] }> = [
  { pattern: /\buseEffect\b/, tags: ["useeffect", "effects", "side-effects", "rerender"] },
  { pattern: /\buseMemo\b/, tags: ["usememo", "rerender", "optimization"] },
  { pattern: /\buseCallback\b/, tags: ["usecallback", "callbacks", "closures"] },
  { pattern: /\buseState\b/, tags: ["usestate", "state", "react"] },
  { pattern: /\buseRef\b/, tags: ["useref", "refs"] },
  {
    pattern: /\buseTransition\b|\bstartTransition\b/,
    tags: ["usetransition", "transitions", "concurrent"]
  },
  { pattern: /\buseDeferredValue\b/, tags: ["usedeferredvalue", "concurrent"] },
  { pattern: /createContext\(|useContext\(/, tags: ["context", "providers", "composition"] },
  { pattern: /\bmemo\(/, tags: ["memo", "rerender"] },
  { pattern: /["']use server["']/, tags: ["server-actions", "server", "rsc"] },
  { pattern: /["']use client["']/, tags: ["client", "rsc"] },
  { pattern: /\bawait\b/, tags: ["async", "await"] },
  { pattern: /\bPromise\.all\b/, tags: ["async", "parallelization", "promises"] },
  {
    pattern: /next\/dynamic|\bdynamic\(/,
    tags: ["bundle", "dynamic-import", "code-splitting"]
  },
  {
    pattern: /from\s+["'][^"']*\/index["']/,
    tags: ["barrel-files", "imports", "tree-shaking"]
  },
  { pattern: /\bcache\(/, tags: ["cache", "memoization"] },
  { pattern: /\bSuspense\b/, tags: ["suspense", "streaming"] },
  { pattern: /\bfetch\(/, tags: ["data-fetching", "async"] },
  {
    pattern: /\bsetTimeout\b|\bsetInterval\b|\brequestAnimationFrame\b|\brequestIdleCallback\b/,
    tags: ["scheduling", "performance", "idle"]
  },
  { pattern: /\baddEventListener\(/, tags: ["event-listeners", "client"] },
  { pattern: /\blocalStorage\b|\bsessionStorage\b/, tags: ["localstorage", "storage"] },
  { pattern: /\.map\(|\.filter\(|\.reduce\(|\.forEach\(/, tags: ["arrays", "loops", "javascript"] }
];

const IMPACT_WEIGHT: Record<string, number> = {
  HIGH: 30,
  MEDIUM: 15,
  LOW: 5,
  UNKNOWN: 0
};

const REACT_SKILLS = new Set(["composition-patterns", "react-best-practices"]);

function deriveIntentTags(filePath: string, diff: string): Set<string> {
  const tags = new Set<string>();
  const ext = path.extname(filePath).toLowerCase();
  for (const t of FILE_TYPE_TAGS[ext] ?? []) tags.add(t);

  if (/(^|\/)(app|pages)\//.test(filePath)) tags.add("rendering");
  if (/(^|\/)api\//.test(filePath)) {
    tags.add("server");
    tags.add("api-routes");
  }
  if (/\.server\./.test(filePath)) tags.add("server");
  if (/\.client\./.test(filePath)) tags.add("client");

  for (const { pattern, tags: hits } of KEYWORD_TAG_HITS) {
    if (pattern.test(diff)) {
      for (const t of hits) tags.add(t);
    }
  }

  return tags;
}

function isSkillApplicable(skillName: string, filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (REACT_SKILLS.has(skillName)) return JS_EXTS.has(ext);
  return true;
}

function scoreRule(rule: LoadedRule, intent: Set<string>, isReactFile: boolean): number {
  let score = 0;
  for (const tag of rule.tags) {
    if (intent.has(tag)) score += 10;
  }
  score += IMPACT_WEIGHT[rule.impact] ?? 0;
  if (isReactFile && rule.tags.some((t) => t === "react" || t === "react19" || t === "rerender")) {
    score += 3;
  }
  return score;
}

export function selectRulesForFile(
  skills: LoadedSkill[],
  input: SelectionInput,
  options: RuleSelectionOptions = {}
): SelectedSkillRules[] {
  const cap = Math.max(1, options.maxRules ?? DEFAULT_MAX_RULES);
  const intent = deriveIntentTags(input.filePath, input.diff);
  const ext = path.extname(input.filePath).toLowerCase();
  const isReactFile = REACT_EXTS.has(ext);

  type ScoredRule = { skillName: string; rule: LoadedRule; score: number };
  const scored: ScoredRule[] = [];
  for (const skill of skills) {
    if (!isSkillApplicable(skill.name, input.filePath)) continue;
    for (const rule of skill.rules) {
      scored.push({
        skillName: skill.name,
        rule,
        score: scoreRule(rule, intent, isReactFile)
      });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ai = IMPACT_WEIGHT[a.rule.impact] ?? 0;
    const bi = IMPACT_WEIGHT[b.rule.impact] ?? 0;
    if (bi !== ai) return bi - ai;
    return a.rule.path.localeCompare(b.rule.path);
  });

  const matched = scored.filter((s) => s.score > 0);
  const keep = matched.slice(0, cap);
  if (keep.length === 0) {
    keep.push(...scored.filter((s) => s.rule.impact === "HIGH").slice(0, Math.min(cap, 4)));
  }

  const out: SelectedSkillRules[] = [];
  for (const skill of skills) {
    if (!isSkillApplicable(skill.name, input.filePath)) continue;
    const ruleSet = keep.filter((s) => s.skillName === skill.name).map((s) => s.rule);
    // Keep skills that contributed at least one rule, OR skills that have no
    // rule files at all (their SKILL.md alone is the guidance, e.g. web-design-guidelines).
    if (ruleSet.length > 0 || skill.rules.length === 0) {
      out.push({ skill, rules: ruleSet });
    }
  }

  return out;
}
