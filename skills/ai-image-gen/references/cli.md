# CLI Reference

## Running the CLI

```bash
cd ~/Developer/ai-img
bun run src/index.ts <command> [options]
```

## Global Options

| Option | Description |
|--------|-------------|
| `--help, -h` | Show help |
| `--version, -v` | Show version |

## Commands

### generate

Generate new images from text prompts.

```bash
bun run src/index.ts generate [options]
```

**Options:**

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--prompt` | `-p` | Text prompt (required) | - |
| `--model` | `-m` | Model ID | Provider default |
| `--provider` | `-P` | Provider: openai, google, fal | openai |
| `--size` | `-s` | Image size (WxH) | 1024x1024 |
| `--aspectRatio` | | Aspect ratio (e.g., 16:9, 4:3, 1:1) - for Gemini models | - |
| `--count` | `-c` | Number of images (1-10) | 1 |
| `--seed` | | Random seed for reproducibility | Random |
| `--quality` | | Quality: low, medium, high, auto | auto |
| `--output` | `-o` | Output file path | output.png |
| `--outDir` | | Output directory | Current dir |

**Examples:**

```bash
# Single image
bun run src/index.ts generate --prompt "A cat" --output cat.png

# Multiple images
bun run src/index.ts generate --prompt "A dog" --count 3 --outDir ./images

# With specific model
bun run src/index.ts generate --prompt "Landscape" --provider fal --model "fal-ai/flux/dev"

# With seed for reproducibility
bun run src/index.ts generate --prompt "Abstract art" --seed 42
```

---

### edit

Edit existing images with AI.

```bash
bun run src/index.ts edit [options]
```

**Options:**

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--prompt` | `-p` | Text prompt (required) | - |
| `--input` | `-i` | Input image path(s) (required) | - |
| `--mask` | `-m` | Mask image path for partial edits | - |
| `--model` | | Model ID | gpt-image-1 |
| `--provider` | `-P` | Provider: openai, google, fal | openai |
| `--size` | `-s` | Image size | 1024x1024 |
| `--count` | `-c` | Number of images | 1 |
| `--output` | `-o` | Output file path | output.png |
| `--outDir` | | Output directory | Current dir |

**Examples:**

```bash
# Basic edit
bun run src/index.ts edit --input photo.jpg --prompt "Add autumn colors"

# With mask for partial edit
bun run src/index.ts edit --input face.jpg --mask hair-mask.png --prompt "Add flowers in hair"

# Multiple inputs (composition)
bun run src/index.ts edit --input "product.png,background.jpg" --prompt "Combine into scene"
```

---

### batch

Process multiple jobs from a JSONL file.

```bash
bun run src/index.ts batch [options]
```

**Options:**

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--input` | `-i` | JSONL file path (required) | - |
| `--outDir` | `-o` | Output directory | ./output |
| `--concurrency` | `-c` | Concurrent API calls (1-25) | 5 |
| `--model` | `-m` | Model ID | gpt-image-1.5 |
| `--provider` | `-P` | Provider: openai, google, fal | openai |
| `--maxAttempts` | | Retry attempts (1-10) | 3 |

**JSONL Format:**

Each line is a JSON object:

```json
{"prompt": "A red car", "out": "red-car.png"}
{"prompt": "A blue car", "n": 2, "out": "blue-car-1.png"}
{"prompt": "A green car", "size": "1536x1024"}
```

**Supported job fields:**
- `prompt` (string, required)
- `n` (number, default: 1)
- `size` (string, default: 1024x1024)
- `model` (string)
- `out` (string, output filename)

**Examples:**

```bash
# Basic batch
bun run src/index.ts batch --input jobs.jsonl

# With concurrency
bun run src/index.ts batch --input jobs.jsonl --concurrency 10

# Custom output directory
bun run src/index.ts batch --input jobs.jsonl --outDir ./generated
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key |
| `GOOGLE_API_KEY` | Google Cloud API key |
| `GEMINI_API_KEY` | Gemini API key (alternative) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Generative AI API key (alternative) |
| `FAL_API_KEY` | FAL AI API key |

## Exit Codes

- `0` - Success
- `1` - Error (invalid arguments, API error, etc.)
