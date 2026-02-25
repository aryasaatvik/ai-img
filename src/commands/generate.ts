import { defineCommand, option } from "@bunli/core";
import { z } from "zod";
import { generateImage } from "ai";
import { getModel, requireApiKey, validateProvider, type ProviderName } from "../lib/provider";
import { writeFile } from "fs/promises";
import { mkdir } from "fs/promises";
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
    provider: option(z.string().default("openai"), {
      short: "P",
      description: "AI provider: openai, google, fal",
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
    const provider = validateProvider(flags.provider);
    requireApiKey(provider);

    if (!flags.prompt) {
      console.error("Error: --prompt is required");
      process.exit(1);
    }

    // Determine output path
    const outDir = flags.outDir || ".";
    const outputPath = flags.outDir
      ? `${flags.outDir}/${flags.output}`
      : flags.output;

    // Ensure output directory exists
    await mkdir(dirname(outputPath), { recursive: true });

    console.log(`Generating ${flags.count} image(s) with ${provider}...`);
    console.log(`Prompt: ${flags.prompt}`);
    console.log(`Model: ${flags.model || "default"}`);
    if (flags.aspectRatio) {
      console.log(`Aspect Ratio: ${flags.aspectRatio}`);
    } else {
      console.log(`Size: ${flags.size}`);
    }

    // Get model
    const model = getModel(provider, flags.model);

    // Build provider options
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

    try {
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

        // Handle base64 or URL
        let data: Uint8Array;
        if (image.base64) {
          // Decode base64 to binary
          const binaryString = atob(image.base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let j = 0; j < binaryString.length; j++) {
            bytes[j] = binaryString.charCodeAt(j);
          }
          data = bytes;
        } else if (image.url) {
          // Fetch from URL
          console.log(`Fetching from URL...`);
          const response = await fetch(image.url);
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
          }
          data = new Uint8Array(await response.arrayBuffer());
        } else {
          throw new Error("No image data available");
        }

        await writeFile(filePath, data);
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
