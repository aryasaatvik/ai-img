# ai-img

AI Image Generation CLI with bunli + AI SDK. Supports OpenAI, Google (Gemini), and Fal AI.

## Install CLI

```bash
bun install
bun run build
```

## Install as Skill

Add to your AI agent skills:

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

```bash
bun install
bun run build
```

## Usage

```bash
# Generate an image
ai-img generate -p "a cat sitting on a chair" -o cat.png

# Generate with specific provider
ai-img generate -p "a sunset" -P google -o sunset.png

# Edit an image
ai-img edit -p "make it blue" -i input.png -o output.png

# Batch process from JSONL
ai-img batch -i jobs.jsonl -o output/
```

## Providers

Set your API key via environment variable:
- OpenAI: `OPENAI_API_KEY`
- Google: `GEMINI_API_KEY` or `GOOGLE_API_KEY`
- Fal: `FAL_API_KEY`

## Options

### generate
- `-p, --prompt` - Text prompt (required)
- `-P, --provider` - AI provider (openai, google, fal)
- `-m, --model` - Model ID
- `-s, --size` - Image size (e.g., 1024x1024)
- `-c, --count` - Number of images
- `-o, --output` - Output file path

### edit
- `-p, --prompt` - Edit prompt (required)
- `-i, --input` - Input image path (required)
- `-m, --mask` - Mask image for partial edits

### batch
- `-i, --input` - JSONL file with one job per line
- `-o, --outDir` - Output directory
- `-c, --concurrency` - Concurrent API calls
