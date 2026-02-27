import { defineCommand, option } from "@bunli/core";
import { z } from "zod";
import { generateImage } from "ai";
import {
  getModel,
  requireApiKey,
  resolveModel,
  resolveProviderSelection,
} from "../lib/provider";
import { mkdir, writeFile } from "fs/promises";
import { dirname } from "path";

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
    size: option(z.string().default("1024x1024"), {
      short: "s",
      description: "Image size (e.g., 1024x1024, 1536x1024)",
    }),
    aspectRatio: option(z.string().optional(), {
      description: "Aspect ratio (e.g., 16:9, 4:3, 1:1) - for Gemini models",
    }),
    count: option(z.coerce.number().min(1).max(10).default(1), {
      short: "c",
      description: "Number of images to generate",
    }),
    seed: option(z.coerce.number().optional(), {
      description: "Random seed for reproducibility",
    }),
    quality: option(z.enum(["low", "medium", "high", "auto"]).optional(), {
      description: "Quality setting (provider-specific)",
    }),
    output: option(z.string().default("output.png"), {
      short: "o",
      description: "Output file path",
    }),
    outDir: option(z.string().optional(), {
      description: "Output directory",
    }),
  },
  handler: async ({ flags }) => {
    if (!flags.prompt) {
      console.error("Error: --prompt is required");
      process.exit(1);
    }

    try {
      const selection = resolveProviderSelection(flags.provider);
      const provider = selection.provider;
      requireApiKey(provider);

      const modelId = resolveModel(provider, flags.model);
      const model = getModel(provider, modelId);

      const outputPath = flags.outDir
        ? `${flags.outDir}/${flags.output}`
        : flags.output;
      await mkdir(dirname(outputPath), { recursive: true });

      console.log(`Generating ${flags.count} image(s) with ${provider}...`);
      console.log(`Prompt: ${flags.prompt}`);
      console.log(`Model: ${modelId}`);
      if (flags.aspectRatio) {
        console.log(`Aspect Ratio: ${flags.aspectRatio}`);
      } else {
        console.log(`Size: ${flags.size}`);
      }

      const providerOptions: Record<string, any> = {};
      if (flags.quality) {
        providerOptions[provider] = { quality: flags.quality };
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
        n: flags.count,
        ...(flags.aspectRatio
          ? { aspectRatio: flags.aspectRatio as `${number}:${number}` }
          : { size: flags.size as `${number}x${number}` }),
        providerOptions: Object.keys(providerOptions).length > 0 ? providerOptions : undefined,
      });

      console.log(`\nGenerated ${result.images.length} image(s)`);

      // Save each image
      for (let i = 0; i < result.images.length; i++) {
        const image = result.images[i];
        const ext = flags.output.split(".").pop() || "png";
        const filePath = flags.count > 1
          ? outputPath.replace(/\.[^.]+$/, `-${i + 1}.${ext}`)
          : outputPath;

        await writeFile(filePath, image.uint8Array);
        console.log(`Saved: ${filePath}`);
      }

      if (result.warnings.length > 0) {
        console.log("\nWarnings:");
        for (const warning of result.warnings) {
          console.log(`  - ${warning}`);
        }
      }

      console.log("\nDone!");
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  },
});
