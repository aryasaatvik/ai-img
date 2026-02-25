# Providers & Models

## Supported Providers

| Provider | Package | Default Model | Env Variable |
|----------|---------|---------------|--------------|
| OpenAI | @ai-sdk/openai | gpt-image-1.5 | OPENAI_API_KEY |
| Google | @ai-sdk/google | imagen-3.0-generate-002 | GOOGLE_API_KEY, GEMINI_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY |
| FAL AI | @ai-sdk/fal | fal-ai/flux/dev | FAL_API_KEY |

## OpenAI Models

| Model | Description | Max Size |
|-------|-------------|----------|
| gpt-image-1.5 | Latest GPT Image model (default) | 1024x1024 |
| gpt-image-1 | Previous version | 1024x1024 |
| dall-e-3 | DALL-E 3 | 1024x1024 |
| dall-e-2 | DALL-E 2 | 1024x1024 |

**Notes:**
- Supports transparency with PNG output
- gpt-image-1 supports image editing
- Quality: low, medium, high, auto

## Google Models

| Model | Description | Max Size |
|-------|-------------|----------|
| gemini-3-pro-image-preview | Gemini 3 Pro Image (latest) | 1024x1024 |
| gemini-2.0-flash-exp | Gemini 2.0 Flash Experimental | 1024x1024 |
| imagen-3.0-generate-002 | Imagen 3 (default) | 2048x2048 |
| imagen-4.0-generate-001 | Imagen 4 | 2048x2048 |
| imagen-4.0-ultra-generate-001 | Imagen 4 Ultra | 2048x2048 |
| imagen-4.0-fast-generate-001 | Imagen 4 Fast | 1024x1024 |

**Notes:**
- Requires Google AI Studio API key
- Supports various aspect ratios
- Includes SynthID watermark

## FAL AI Models

| Model | Description |
|-------|-------------|
| fal-ai/flux/dev | Flux Dev (default) |
| fal-ai/flux/pro/v1.1-ultra | Flux Pro Ultra |
| fal-ai/flux-lora | Flux with LoRA |
| fal-ai/fast-sdxl | Fast SDXL |
| fal-ai/stable-diffusion-3.5-large | SD 3.5 Large |
| fal-ai/recraft-v3 | Recraft V3 |
| fal-ai/ideogram/v2 | Ideogram V2 |

**Notes:**
- Wide variety of models
- Some support image-to-image
- Check FAL AI docs for latest models

## Choosing a Provider

| Use Case | Recommended Provider |
|----------|---------------------|
| General purpose | OpenAI (gpt-image-1.5) |
| High quality, latest | Google (imagen-3.0-generate-002) |
| Creative/style | FAL AI (flux models) |
| Budget | FAL AI (fast-sdxl) |
| Image editing | OpenAI (gpt-image-1) or FAL (flux) |

## API Keys

Get your API keys from:

- **OpenAI**: https://platform.openai.com/api-keys
- **Google**: https://aistudio.google.com/app/apikey
- **FAL AI**: https://fal.ai/dashboard/keys
