# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-27

## OVERVIEW
AI Image Generation CLI built with Bun + Bunli. Supports OpenAI, Google (Gemini), and Fal providers for generation, editing, batch jobs, status inspection, and runtime config management.

## STRUCTURE
```
ai-img/
├── src/
│   ├── index.ts            # CLI entry point
│   ├── commands/
│   │   ├── generate.ts     # Image generation
│   │   ├── edit.ts         # Image editing
│   │   ├── batch.ts        # Batch processing
│   │   ├── status.ts       # Provider/config diagnostics
│   │   └── config/         # Config init/show/set/unset group
│   └── lib/
│       ├── provider.ts     # Provider + credential resolution
│       └── config.ts       # Runtime config schema/load/resolve helpers
├── scripts/
│   └── generate-json-schema.ts  # Zod -> ai-img.schema.json
├── ai-img.schema.json      # Generated JSON Schema for IDE autocomplete
├── package.json
├── tsconfig.json
└── bunli.config.ts
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Add new command | `src/commands/` | Use `defineCommand` + `option` |
| Add new provider | `src/lib/provider.ts` | Update metadata + factory + priority |
| Runtime config behavior | `src/lib/config.ts` | Schema, merge precedence, editable keys |
| Config command UX | `src/commands/config/` | `init/show/set/unset` |
| Preview mode + rendering | `src/lib/preview.ts` | Flag/config precedence + runtime render calls |
| CLI configuration | `src/index.ts` | Command registration + Bunli plugins |
| Schema generation | `scripts/generate-json-schema.ts` | Emits `ai-img.schema.json` |

## CONVENTIONS
- Commands use Bunli APIs: `defineCommand`, `option`, handler args.
- Zod schemas validate options and runtime config.
- AI operations use `generateImage()` from `ai` package.
- Provider logic is centralized in `provider.ts`.
- Runtime config is namespaced under `aiImg` and validated strictly.

## CONFIG + CREDENTIALS
- Config source order:
  1. `~/.config/ai-img/config.json`
  2. `.ai-imgrc`
  3. `.ai-imgrc.json`
  4. `.ai-imgrc.local.json`
- Runtime precedence: flags > project config > user config > code defaults.
- Credential precedence: env vars > `aiImg.secrets.<provider>`.

## COMMANDS
```bash
# Install
bun install

# Dev / build / typecheck
bun run dev
bun run build
bun run typecheck

# Generate JSON Schema for IDE autocomplete
bun run generate:schema
bun run generate:schema:check

# Generate image
ai-img generate -p "a cat" -P openai -o output.png

# Edit image
ai-img edit -p "make it blue" -i input.png -o edited.png

# Batch process
ai-img batch -i jobs.jsonl -o output/

# Status + config
ai-img status
ai-img config init
ai-img config show
ai-img config set aiImg.defaults.provider openai

# Shell completions
ai-img completions zsh
```

## AGENTS.md LOCATIONS
- `src/` for code architecture and command behavior
- `scripts/` for schema generation workflow
