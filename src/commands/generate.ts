import { defineCommand, option } from "@bunli/core";
import { z } from "zod";
import { generateImage } from "ai";
import {
  formatImageWarning,
  getModel,
  requireApiKey,
  resolveImageDimensions,
  resolveModel,
  resolveProviderSelection,
} from "../lib/provider";
import { loadAiImgConfig, resolveRuntimeConfig } from "../lib/config";
import {
  preflightStrictPreview,
  renderPreviewImage,
  resolvePreviewOptions,
} from "../lib/preview";
import { imageModeOption } from "./shared/preview-options";
import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";

export const generateCommand = defineCommand({
  name: "generate",
  description: "Generate new images from a text prompt",
  options: {
    prompt: option(z.string().min(1), {
      short: "p",
      description: "Text prompt for image generation",
    }),
    model: option(z.string().optional(), {
      short: "m",
      description: "Model ID to use (default varies by provider)",
    }),
    provider: option(z.string().optional(), {
      short: "P",
      description: "AI provider: openai, google, fal (auto-detected if omitted)",
    }),
    size: option(z.string().optional(), {
      short: "s",
      description: "Image size (e.g., 1024x1024, 1536x1024)",
    }),
    aspectRatio: option(z.string().optional(), {
      description: "Aspect ratio (e.g., 16:9, 4:3, 1:1) - for Gemini models",
    }),
    count: option(z.coerce.number().min(1).max(10).optional(), {
      short: "c",
      description: "Number of images to generate",
    }),
    seed: option(z.coerce.number().optional(), {
      description: "Random seed for reproducibility",
    }),
    quality: option(z.enum(["low", "medium", "high", "auto"]).optional(), {
      description: "Quality setting (provider-specific)",
    }),
    output: option(z.string().optional(), {
      short: "o",
      description: "Output file path",
    }),
    outDir: option(z.string().optional(), {
      description: "Output directory",
    }),
    "image-mode": imageModeOption,
  },
  handler: async ({ flags, cwd }) => {
    if (!flags.prompt) {
      console.error("Error: --prompt is required");
      process.exit(1);
    }

    try {
      const loadedConfig = await loadAiImgConfig({ cwd });
      const runtimeConfig = resolveRuntimeConfig(loadedConfig.config);
      const previewOptions = resolvePreviewOptions(runtimeConfig, flags);
      preflightStrictPreview(previewOptions);
      const secrets = runtimeConfig.secrets;

      const requestedProvider = flags.provider ?? runtimeConfig.defaults.provider;
      const selection = resolveProviderSelection(requestedProvider, secrets);
      const provider = selection.provider;
      requireApiKey(provider, secrets);
      const modelId = resolveModel(provider, flags.model ?? runtimeConfig.defaults.model);
      const model = getModel(provider, modelId, secrets);

      const dimensions = resolveImageDimensions({
        provider,
        model: modelId,
        size: flags.size,
        aspectRatio: flags.aspectRatio,
        configSize: runtimeConfig.defaults.size,
        configAspectRatio: runtimeConfig.defaults.aspectRatio,
      });
      const count = flags.count ?? runtimeConfig.generate.count;
      const quality = flags.quality ?? runtimeConfig.generate.quality;
      const output = flags.output ?? runtimeConfig.defaults.output;
      const outDir = flags.outDir ?? runtimeConfig.defaults.outDir;
      const outputPath = outDir ? join(outDir, output) : output;
      await mkdir(dirname(outputPath), { recursive: true });

      console.log(`Generating ${count} image(s) with ${provider}...`);
      console.log(`Prompt: ${flags.prompt}`);
      console.log(`Model: ${modelId}`);
      if (dimensions.aspectRatio) {
        console.log(`Aspect Ratio: ${dimensions.aspectRatio}`);
      } else if (dimensions.size) {
        console.log(`Size: ${dimensions.size}`);
      } else {
        console.log("Dimensions: provider/model default");
      }

      const providerOptions: Record<string, any> = {};
      if (quality) {
        providerOptions[provider] = { quality };
      }
      if (flags.seed) {
        providerOptions[provider] = {
          ...providerOptions[provider],
          seed: flags.seed,
        };
      }

      const result = await generateImage({
        model,
        prompt: flags.prompt,
        n: count,
        ...(dimensions.aspectRatio ? { aspectRatio: dimensions.aspectRatio } : {}),
        ...(dimensions.size ? { size: dimensions.size } : {}),
        providerOptions: Object.keys(providerOptions).length > 0 ? providerOptions : undefined,
      });

      console.log(`\nGenerated ${result.images.length} image(s)`);

      // Save each image
      for (let i = 0; i < result.images.length; i++) {
        const image = result.images[i];
        const ext = output.split(".").pop() || "png";
        const filePath = count > 1
          ? outputPath.replace(/\.[^.]+$/, `-${i + 1}.${ext}`)
          : outputPath;

        await writeFile(filePath, image.uint8Array);
        console.log(`Saved: ${filePath}`);

        if (previewOptions.mode !== "off") {
          const previewResult = await renderPreviewImage(
            image.uint8Array,
            previewOptions,
            filePath
          );
          if (previewResult.rendered) {
            console.log(`Preview: rendered (${filePath})`);
          } else {
            console.log(`Preview: skipped (${previewResult.reason ?? "not-rendered"})`);
          }
        }
      }

      if (result.warnings.length > 0) {
        console.log("\nWarnings:");
        for (const warning of result.warnings) {
          console.log(`  - ${formatImageWarning(warning)}`);
        }
      }

      console.log("\nDone!");
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  },
});

export default generateCommand;
