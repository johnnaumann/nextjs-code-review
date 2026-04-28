# nextjs-code-review

Local-LLM code review CLI for Next.js branches, powered by **Ollama** and **Vercel agent-skills**.

## Install

```bash
npm i -D nextjs-code-review
```

Or run without installing:

```bash
npx nextjs-code-review review -y
```

## Prerequisites

- **Ollama** running locally.
- Pull the default model (recommended):

```bash
ollama pull qwen2.5-coder:14b
```

The default model was bumped from `:7b` to `:14b` because the 7B model
struggles to follow the JSON schema reliably under a non-trivial skill
prompt. If you want lower memory pressure, pass `--model qwen2.5-coder:7b`.

## Quick start

Install the default skills into the current repo:

```bash
npx nextjs-code-review skills install
```

Run a review (branch diff vs your default remote branch):

```bash
npx nextjs-code-review review
```

If you haven't installed skills yet, you can auto-install them on the first run:

```bash
npx nextjs-code-review review -y
```

## What it writes to your repo

- **Skills**: `.code-review/skills/` (pulled from `vercel-labs/agent-skills`, pinned via `.code-review/skills/.lock.json`)
- **Reports**: `.code-review/reports/<branch>-<timestamp>.md`

Recommended policy:
- Commit `.code-review/skills/` + `.code-review/skills/.lock.json` so the whole team uses the same pinned rules and CI stays offline.
- Gitignore `.code-review/reports/` (the CLI writes `.code-review/.gitignore` with `reports/` when you choose to add it).

## Commands

### `review`

```bash
npx nextjs-code-review review \
  [--base <ref>] [--staged] [--commit <sha>] \
  [--model <name>] [--num-ctx <n>] [--temperature <n>] \
  [--skills <csv>] [--skills-dir <path>] [--max-rules <n>] \
  [--retries <n>] [--no-cache] [-y]
```

Notable flags:

- `--num-ctx <n>` (default `16384`): Ollama's context window. The CLI sets
  this explicitly because Ollama's default of 2048 silently truncates
  prompts the moment skills are involved.
- `--max-rules <n>` (default `12`): cap on rules included in the prompt
  per file. Rules are scored by tag overlap with the file's path/extension
  and diff content, plus their declared `impact`.
- `--retries <n>` (default `1`): on JSON-parse / schema-validation failure
  the CLI re-asks the model with the validation error appended.
- `--no-cache`: disable the per-file result cache at `.code-review/cache/`.

Files that are auto-skipped before being sent to the model:

- empty / pure-deletion patches
- near-empty new files (e.g. empty barrel `index.ts`)
- generated paths: `node_modules/`, `dist/`, `build/`, `.next/`, `out/`,
  `coverage/`, `src/gen/`, `__generated__/`, `*.generated.*`, `*.min.{js,css}`
- lockfiles (`yarn.lock`, `package-lock.json`, `pnpm-lock.yaml`, `bun.lockb`)
- snapshots (`*.snap`)
- common binary / asset extensions (images, fonts, media, archives, wasm)

Examples:

- Review against a specific base:

```bash
npx nextjs-code-review review --base origin/main
```

- Review staged changes only:

```bash
npx nextjs-code-review review --staged
```

- Review a specific commit:

```bash
npx nextjs-code-review review --commit HEAD
```

- Use a different Ollama model:

```bash
npx nextjs-code-review review --model deepseek-coder-v2:16b
```

- Apply only a subset of installed skills:

```bash
npx nextjs-code-review review --skills react-best-practices,composition-patterns
```

### `skills`

- List installed skills:

```bash
npx nextjs-code-review skills list
```

- Install defaults (composition-patterns, react-best-practices, web-design-guidelines):

```bash
npx nextjs-code-review skills install
```

- Install one additional skill from the Vercel repo:

```bash
npx nextjs-code-review skills add deploy-to-vercel
```

- Refresh skills to latest main:

```bash
npx nextjs-code-review skills refresh
```

## Configuration

- **Ollama host**: set `OLLAMA_HOST` (default: `http://localhost:11434`)
- **Skills directory**: set `NEXTJS_CODE_REVIEW_SKILLS_DIR` (default: `.code-review/skills`)
- **GitHub token**: set `GITHUB_TOKEN` if you hit rate limits
- **Offline mode**: set `NEXTJS_CODE_REVIEW_OFFLINE=1` to disable auto-fetch (the CLI will fail fast if skills are missing)

## How prompts are built

For each reviewable file the CLI sends one Ollama chat call:

1. **Skill loader** reads each skill's `SKILL.md` (frontmatter stripped) and
   every `.md` under `rules/` (excluding files prefixed with `_`).
   `AGENTS.md` / `README.md` at the skill root are intentionally ignored.
2. **Per-file rule selector** picks at most `--max-rules` rules whose
   tags overlap with intent tags derived from the file's extension/path
   and from keywords detected in the diff (`useEffect`, `Promise.all`,
   `"use server"`, etc.). Rules with declared `HIGH` impact are weighted up.
3. **System prompt** = a concise reviewer instruction + JSON schema +
   the rendered (skill, selected rules) blocks.
4. **User prompt** = `File: <path>` + the unified diff.
5. The response is parsed as JSON and validated against a Zod schema; on
   failure the CLI re-asks once with the validation error appended.

## Caching

Successful per-file reviews are cached under `.code-review/cache/<hash>.json`.
The cache key is a SHA-256 of `(model, num_ctx, temperature, skills lock SHAs,
file path, patch, system prompt, CLI version)`, so any change to inputs
invalidates the entry automatically. Disable with `--no-cache`.

## Publishing

This repo is configured to publish to npm on `v*` tags via GitHub Actions (requires `NPM_TOKEN` secret).

