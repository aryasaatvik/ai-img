import { defineCommand, option } from "@bunli/core";
import { z } from "zod";
import { generateImage } from "ai";
import {
  getModel,
  requireApiKey,
  resolveModel,
  resolveProviderSelection,
  validateProvider,
} from "../lib/provider";
import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname } from "path";

interface BatchJob {
  prompt: string;
  n?: number;
  size?: string;
  model?: string;
  provider?: string;
  out?: string;
  [key: string]: unknown;
}

export const batchCommand = defineCommand({
  name: "batch",
  description: "Batch generate images from a JSONL file",
  options: {
    input: option(z.string().min(1), {
      short: "i",
      description: "Input JSONL file path (one job per line)",
    }),
    outDir: option(z.string().default("./output"), {
      short: "o",
      description: "Output directory",
    }),
    concurrency: option(z.coerce.number().min(1).max(25).default(5), {
      short: "c",
      description: "Concurrent API calls",
    }),
    model: option(z.string().optional(), {
      short: "m",
      description: "Model ID to use (default varies by provider)",
    }),
    provider: option(z.string().optional(), {
      short: "P",
      description: "AI provider: openai, google, fal (auto-detected if omitted)",
    }),
    maxAttempts: option(z.coerce.number().min(1).max(10).default(3), {
      description: "Max retry attempts for failed jobs",
    }),
  },
  handler: async ({ flags }) => {
    if (!flags.input) {
      console.error("Error: --input is required");
      process.exit(1);
    }

    try {
      const selection = resolveProviderSelection(flags.provider);
      const provider = selection.provider;
      requireApiKey(provider);

      const defaultModelId = resolveModel(provider, flags.model);

      await mkdir(flags.outDir, { recursive: true });

      const content = await readFile(flags.input, "utf-8");
      const lines = content.trim().split("\n").filter((line) => line.trim());

      console.log(`Default model: ${defaultModelId}`);
      console.log(`Processing ${lines.length} jobs with concurrency ${flags.concurrency}...`);

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < lines.length; i += flags.concurrency) {
        const batch = lines.slice(i, i + flags.concurrency);
        const results = await Promise.allSettled(
          batch.map(async (line, idx) => {
            const job: BatchJob = JSON.parse(line);
            const jobIndex = i + idx;
            const jobProvider = job.provider ? validateProvider(job.provider) : provider;
            requireApiKey(jobProvider);

            const jobModelInput = job.model || flags.model;
            const jobModelId = resolveModel(jobProvider, jobModelInput);
            const model = getModel(jobProvider, jobModelId);

            console.log(
              `[${jobIndex + 1}/${lines.length}] Generating (${jobProvider}/${jobModelId}): ${job.prompt?.substring(0, 50)}...`
            );

            let attempts = 0;
            while (attempts < flags.maxAttempts) {
              try {
                const result = await generateImage({
                  model,
                  prompt: job.prompt,
                  n: job.n || 1,
                  size: (job.size as `${number}x${number}`) || "1024x1024",
                });

                for (let imgIdx = 0; imgIdx < result.images.length; imgIdx++) {
                  const image = result.images[imgIdx];
                  const outFile = job.out || `output-${jobIndex}-${imgIdx}.png`;
                  const filePath = `${flags.outDir}/${outFile}`;

                  await mkdir(dirname(filePath), { recursive: true });
                  await writeFile(filePath, image.uint8Array);
                  console.log(`  Saved: ${filePath}`);
                }

                return { success: true };
              } catch (error) {
                attempts++;
                if (attempts >= flags.maxAttempts) {
                  throw error;
                }
                console.log(`  Retry ${attempts}/${flags.maxAttempts}...`);
                await new Promise((r) => setTimeout(r, 1000 * attempts));
              }
            }

            return { success: true };
          })
        );

        for (const result of results) {
          if (result.status === "fulfilled" && result.value.success) {
            successCount++;
          } else {
            failCount++;
            const error = result.status === "rejected" ? result.reason : result.value;
            console.error(`  Failed: ${error instanceof Error ? error.message : error}`);
          }
        }
      }

      console.log(`\nDone! Success: ${successCount}, Failed: ${failCount}`);
      if (failCount > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  },
});
