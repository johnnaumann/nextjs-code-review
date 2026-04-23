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
ollama pull qwen2.5-coder:7b
```

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
npx nextjs-code-review review [--base <ref>] [--staged] [--commit <sha>] [--model <name>] [--skills <csv>] [--skills-dir <path>] [-y]
```

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

## Publishing

This repo is configured to publish to npm on `v*` tags via GitHub Actions (requires `NPM_TOKEN` secret).

