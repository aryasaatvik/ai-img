import { defineCommand, option } from "@bunli/core";
import { z } from "zod";
import { generateImage } from "ai";
import { getModel, requireApiKey, validateProvider } from "../lib/provider";
import { readFile } from "fs/promises";
import { writeFile } from "fs/promises";
import { mkdir } from "fs/promises";
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
    model: option(z.string().default("gpt-image-1"), {
      description: "Model ID to use",
    }),
    provider: option(z.string().default("openai"), {
      short: "P",
      description: "AI provider: openai, google, fal",
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
    const provider = validateProvider(flags.provider);
    requireApiKey(provider);

    if (!flags.prompt) {
      console.error("Error: --prompt is required");
      process.exit(1);
    }

    if (!flags.input) {
      console.error("Error: --input is required");
      process.exit(1);
    }

    // Determine output path
    const outputPath = flags.outDir
      ? `${flags.outDir}/${flags.output}`
      : flags.output;

    await mkdir(dirname(outputPath), { recursive: true });

    console.log(`Editing image(s) with ${provider}...`);
    console.log(`Input: ${flags.input}`);
    console.log(`Prompt: ${flags.prompt}`);
    if (flags.mask) {
      console.log(`Mask: ${flags.mask}`);
    }

    // Read input image(s)
    const inputPaths = flags.input.split(",");
    const imageBuffers: Buffer[] = [];
    for (const inputPath of inputPaths) {
      const buffer = await readFile(inputPath.trim());
      imageBuffers.push(buffer);
    }

    // Read mask if provided
    let maskBuffer: Buffer | undefined;
    if (flags.mask) {
      maskBuffer = await readFile(flags.mask);
    }

    const model = getModel(provider, flags.model);

    try {
      const result = await generateImage({
        model,
        prompt: {
          text: flags.prompt,
          images: imageBuffers.map(b => ({ data: b.toString("base64"), mimeType: "image/png" })),
          ...(maskBuffer && { mask: { data: maskBuffer.toString("base64"), mimeType: "image/png" } }),
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

        let data: Uint8Array;
        if (image.base64) {
          const binaryString = atob(image.base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let j = 0; j < binaryString.length; j++) {
            bytes[j] = binaryString.charCodeAt(j);
          }
          data = bytes;
        } else if (image.url) {
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

      console.log("\nDone!");
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  },
});
