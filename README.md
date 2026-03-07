# ai-img

AI image generation CLI built with Bun + Bunli + AI SDK.

## Install

```bash
bun add -g ai-img
```

Or local development:

```bash
git clone https://github.com/aryasaatvik/ai-img
cd ai-img
bun install
bun run build
```

## Install as Agent Skill

Add to your AI agent:

```bash
# For Claude Code
npx skills add aryasaatvik/ai-img -a claude-code

# For OpenCode
npx skills add aryasaatvik/ai-img -a opencode

# For all agents
npx skills add aryasaatvik/ai-img
```

Or install locally:

```bash
npx skills add ./skills/ai-image-gen
```

See [skills/ai-image-gen](./skills/ai-image-gen/) for full skill documentation.

## Commands

```bash
# Generate images
ai-img generate -p "a cat wearing sunglasses" -o cat.png

# Edit images
ai-img edit -p "make it blue" -i input.png -o output.png

# Batch jobs from JSONL
ai-img batch -i jobs.jsonl -o ./output

# Provider/config status
ai-img status

# Force strict preview rendering (supported on generate/edit)
ai-img generate -p "a cat wearing sunglasses" --image-mode on
ai-img edit -p "make it blue" -i input.png --image-mode on

# Inspect preview mode resolution with explicit flag
ai-img status --image-mode on

# Manage runtime config
ai-img config init
ai-img config init --target project
ai-img config show
ai-img config set aiImg.defaults.provider openai
ai-img config set aiImg.preview.mode auto
ai-img config unset aiImg.defaults.provider

# Generate shell completions
ai-img completions bash
ai-img completions zsh
ai-img completions fish
```

## Shell Completions

The completions plugin adds a `completions` command for Bash/Zsh/Fish.

Quick install patterns:

```bash
# Bash (current session)
source <(ai-img completions bash)

# Zsh (save file)
mkdir -p ~/.zsh/completions
ai-img completions zsh > ~/.zsh/completions/_ai-img

# Fish (save file)
ai-img completions fish > ~/.config/fish/completions/ai-img.fish
```

## Providers

Supported providers: `openai`, `google`, `fal`.

Credential resolution order is:
1. Environment variables
2. Config secrets (`aiImg.secrets.<provider>`)

Environment variable names:
- OpenAI: `OPENAI_API_KEY`
- Google: `GOOGLE_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`
- Fal: `FAL_API_KEY`

## Runtime Config

Config is loaded from these sources (deep merged, later overrides earlier):
1. `~/.config/ai-img/config.json`
2. `.ai-imgrc`
3. `.ai-imgrc.json`
4. `.ai-imgrc.local.json`

Runtime precedence is:
1. CLI flags
2. Project config
3. User config
4. Built-in defaults

`config init/set/unset` defaults to `--target user`. Use `--target project` to write local project config.

Image dimensions are model-aware:
- Set `aiImg.defaults.size` for size-based models.
- Set `aiImg.defaults.aspectRatio` for aspect-ratio-based models.
- If neither is configured, `ai-img` uses a blessed model preset when known, otherwise it leaves dimensions unset and uses the provider/model default.
- Existing `size` defaults are automatically converted for blessed Google image models when possible.

For preview mode specifically, precedence is:
1. `--image-mode` flag
2. `aiImg.preview.mode` config
3. default `auto`

### Config Schema

```json
{
  "aiImg": {
    "schemaVersion": 1,
    "defaults": {
      "provider": "openai",
      "model": "gpt-image-1.5",
      "size": "1024x1024",
      "aspectRatio": "1:1",
      "output": "output.png",
      "outDir": "./output"
    },
    "generate": {
      "quality": "auto",
      "count": 1
    },
    "edit": {
      "count": 1
    },
    "batch": {
      "concurrency": 5,
      "maxAttempts": 3
    },
    "preview": {
      "mode": "auto",
      "protocol": "auto",
      "width": 32
    },
    "secrets": {
      "openai": "...",
      "google": "...",
      "fal": "..."
    }
  }
}
```

Set either `size` or `aspectRatio` for a given workflow. If both exist in config, `ai-img` prefers the model-native option for the selected blessed model.

Batch JSONL jobs can also override dimensions per job with either field:

```json
{"prompt":"Green terminal UI", "aspectRatio":"16:9"}
```

### Terminal Preview Notes

- Preview mode values: `off`, `auto`, `on`
- `auto` is best-effort and non-fatal when rendering is unavailable
- `on` is strict and fails fast before provider API calls when preview is unsupported
- Default thumbnail width is `32` columns; only width is set so aspect ratio is preserved
- Current protocol support is Kitty-compatible terminals (for example Kitty, Ghostty)
- `aiImg.schemaVersion` defaults to `1` during config load when omitted

## IDE Autocomplete via JSON Schema

The config schema is generated from Zod and published as `ai-img.schema.json`.

Generate/update it:

```bash
bun run generate:schema
```

Check for drift:

```bash
bun run generate:schema:check
```

Use it in your config file:

```json
{
  "$schema": "./ai-img.schema.json",
  "aiImg": {
    "schemaVersion": 1
  }
}
```

## Scripts

```bash
bun run dev
bun run build
bun run typecheck
bun run generate:schema
bun run generate:schema:check
```
