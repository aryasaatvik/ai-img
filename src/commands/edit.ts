import { defineCommand, option } from "@bunli/core";
import { z } from "zod";
import { generateImage } from "ai";
import {
  getModel,
  requireApiKey,
  resolveModel,
  resolveProviderSelection,
} from "../lib/provider";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname } from "path";

export const editCommand = defineCommand({
  name: "edit",
  description: "Edit an existing image with AI",
  options: {
    prompt: option(z.string().min(1), {
      short: "p",
      description: "Text prompt for editing",
    }),
    input: option(z.string().min(1), {
      short: "i",
      description: "Input image path(s) - first image is primary",
    }),
    mask: option(z.string().optional(), {
      short: "m",
      description: "Mask image path (for partial edits)",
    }),
    model: option(z.string().optional(), {
      description: "Model ID to use (default varies by provider)",
    }),
    provider: option(z.string().optional(), {
      short: "P",
      description: "AI provider: openai, google, fal (auto-detected if omitted)",
    }),
    size: option(z.string().default("1024x1024"), {
      short: "s",
      description: "Image size",
    }),
    count: option(z.coerce.number().min(1).max(10).default(1), {
      short: "c",
      description: "Number of images to generate",
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

    if (!flags.input) {
      console.error("Error: --input is required");
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

      console.log(`Editing image(s) with ${provider}...`);
      console.log(`Input: ${flags.input}`);
      console.log(`Prompt: ${flags.prompt}`);
      console.log(`Model: ${modelId}`);
      if (flags.mask) {
        console.log(`Mask: ${flags.mask}`);
      }

      const inputPaths = flags.input.split(",");
      const imageBuffers: Buffer[] = [];
      for (const inputPath of inputPaths) {
        const buffer = await readFile(inputPath.trim());
        imageBuffers.push(buffer);
      }

      let maskBuffer: Buffer | undefined;
      if (flags.mask) {
        maskBuffer = await readFile(flags.mask);
      }

      const result = await generateImage({
        model,
        prompt: {
          text: flags.prompt,
          images: imageBuffers,
          ...(maskBuffer && { mask: maskBuffer }),
        },
        n: flags.count,
        size: flags.size as `${number}x${number}`,
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

      console.log("\nDone!");
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  },
});
