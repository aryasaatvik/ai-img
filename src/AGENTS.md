# SOURCE CODE

## OVERVIEW
CLI source code with command handlers and provider abstraction.

## STRUCTURE
```
src/
├── index.ts      # CLI bootstrap
├── commands/     # generate, edit, batch commands
└── lib/          # Shared provider utilities
```

## WHERE TO LOOK
| Task | Location |
|------|----------|
| Add new command | src/commands/ - follow defineCommand pattern |
| Modify provider logic | src/lib/provider.ts |
| CLI entry point | src/index.ts |

## CONVENTIONS
- Command files export single const using defineCommand
- Handler receives { flags } destructured from options
- Options defined with zod schemas
- Provider abstraction in lib/provider.ts handles all AI SDK interactions

## KEY PATTERNS
```typescript
// Command structure
export const commandName = defineCommand({
  name: "command",
  description: "...",
  options: {
    opt: option(z.type(), { short: "x", description: "..." })
  },
  handler: async ({ flags }) => { /* ... */ }
});
```
