# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-25

## OVERVIEW
AI Image Generation CLI built with Bun + bunli framework. Supports OpenAI, Google (Gemini), and Fal AI providers for image generation, editing, and batch processing.

## STRUCTURE
```
ai-img/
├── src/
│   ├── index.ts          # CLI entry point
│   ├── commands/         # Command implementations
│   │   ├── generate.ts   # Image generation command
│   │   ├── edit.ts       # Image editing command
│   │   └── batch.ts      # Batch processing command
│   └── lib/
│       └── provider.ts   # AI provider abstraction
├── package.json
├── tsconfig.json
└── bunli.config.ts
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Add new command | src/commands/ | Use defineCommand from @bunli/core |
| Add new provider | src/lib/provider.ts | Implement in getProvider switch |
| CLI configuration | src/index.ts | Register commands with cli.command() |
| Build config | bunli.config.ts | bunli CLI config |

## CONVENTIONS
- All commands use `@bunli/core` defineCommand + option APIs
- Zod for option validation (z.string(), z.coerce.number(), etc.)
- AI SDK via `ai` package - use generateImage() for all image operations
- Provider-agnostic via src/lib/provider.ts abstraction
- Environment variables for API keys: OPENAI_API_KEY, GOOGLE_API_KEY/GEMINI_API_KEY, FAL_API_KEY

## ANTI-PATTERNS (THIS PROJECT)
- Don't hardcode provider-specific logic in commands - use provider.ts abstraction
- Don't use console.log in production - error handling uses console.error + process.exit(1)

## COMMANDS
```bash
# Install
bun install

# Dev
bun run dev

# Build
bun run build

# Generate image
ai-img generate -p "a cat" -P openai -o output.png

# Edit image
ai-img edit -p "make it blue" -i input.png -o edited.png

# Batch process
ai-img batch -i jobs.jsonl -o output/
```

## AGENTS.md LOCATIONS
- src/ - Source code patterns and command structure
