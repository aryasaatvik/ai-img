import { readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import { z } from "zod";
import { AiImgConfigSchema } from "../src/lib/config";

const SCHEMA_ID = "https://ai-img.dev/schemas/ai-img.schema.json";
const OUTPUT_PATH = resolve(import.meta.dir, "..", "ai-img.schema.json");
const CHECK_MODE = process.argv.includes("--check");

const generatedSchema = z.toJSONSchema(AiImgConfigSchema);
const schemaWithMeta = {
  ...generatedSchema,
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: SCHEMA_ID,
} as const;

const output = `${JSON.stringify(schemaWithMeta, null, 2)}\n`;

if (CHECK_MODE) {
  let existing: string;
  try {
    existing = await readFile(OUTPUT_PATH, "utf-8");
  } catch {
    console.error(`Schema file missing at ${OUTPUT_PATH}. Run: bun run generate:schema`);
    process.exit(1);
  }

  if (existing !== output) {
    console.error(
      `Schema file is out of date at ${OUTPUT_PATH}. Run: bun run generate:schema`
    );
    process.exit(1);
  }

  console.log("Schema is up to date.");
  process.exit(0);
}

await writeFile(OUTPUT_PATH, output, "utf-8");
console.log(`Wrote ${OUTPUT_PATH}`);
