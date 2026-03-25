import { mkdir, readFile, writeFile } from "fs/promises";
import { homedir } from "os";
import { dirname, resolve } from "path";

import { z } from "zod";

import type { ProviderName } from "./provider";

export type ConfigTarget = "user" | "project";

export const PROVIDERS = ["openai", "google", "fal"] as const;
export const QUALITY_LEVELS = ["low", "medium", "high", "auto"] as const;

const ProviderSchema = z.enum(PROVIDERS);
const QualitySchema = z.enum(QUALITY_LEVELS);

const AiImgDefaultsSchema = z
  .object({
    provider: ProviderSchema.optional(),
    model: z.string().min(1).optional(),
    size: z
      .string()
      .regex(/^\d+x\d+$/, "Expected WIDTHxHEIGHT")
      .optional(),
    aspectRatio: z
      .string()
      .regex(/^\d+:\d+$/, "Expected WIDTH:HEIGHT")
      .optional(),
    output: z.string().min(1).optional(),
    outDir: z.string().min(1).optional(),
  })
  .strict();

const AiImgGenerateSchema = z
  .object({
    quality: QualitySchema.optional(),
    count: z.number().int().min(1).max(10).optional(),
  })
  .strict();

const AiImgEditSchema = z
  .object({
    count: z.number().int().min(1).max(10).optional(),
  })
  .strict();

const AiImgBatchSchema = z
  .object({
    concurrency: z.number().int().min(1).max(25).optional(),
    maxAttempts: z.number().int().min(1).max(10).optional(),
  })
  .strict();

const AiImgPreviewSchema = z
  .object({
    mode: z.enum(["off", "auto", "on"]).optional(),
    protocol: z.enum(["auto", "kitty"]).optional(),
    width: z.number().int().min(1).optional(),
  })
  .strict();

const AiImgSecretsSchema = z
  .object({
    openai: z.string().min(1).optional(),
    google: z.string().min(1).optional(),
    fal: z.string().min(1).optional(),
  })
  .strict();

const AiImgConfigBodySchema = z
  .object({
    defaults: AiImgDefaultsSchema.optional(),
    generate: AiImgGenerateSchema.optional(),
    edit: AiImgEditSchema.optional(),
    batch: AiImgBatchSchema.optional(),
    preview: AiImgPreviewSchema.optional(),
    secrets: AiImgSecretsSchema.optional(),
  })
  .strict();

export const AiImgConfigFileSchema = z
  .object({
    aiImg: AiImgConfigBodySchema.extend({
      schemaVersion: z.literal(1).optional(),
    }),
  })
  .strict();

export const AiImgConfigSchema = z
  .object({
    aiImg: AiImgConfigBodySchema.extend({
      schemaVersion: z.literal(1),
    }),
  })
  .strict();

export type AiImgConfig = z.infer<typeof AiImgConfigSchema>;
type AiImgConfigFile = z.infer<typeof AiImgConfigFileSchema>;

export type ProviderSecretMap = Partial<Record<ProviderName, string>>;

type PrimitiveLeaf = string | number | boolean | bigint | null | undefined;
type DotLeafPaths<T, Prefix extends string = ""> = T extends PrimitiveLeaf
  ? Prefix
  : T extends readonly unknown[]
    ? Prefix
    : T extends Record<string, unknown>
      ? {
          [K in keyof T & string]: DotLeafPaths<
            NonNullable<T[K]>,
            Prefix extends "" ? K : `${Prefix}.${K}`
          >;
        }[keyof T & string]
      : Prefix;
type EditableConfigKey = Extract<DotLeafPaths<AiImgConfigFile>, `aiImg.${string}`>;

export interface ConfigSource {
  path: string;
  kind: ConfigTarget;
}

export interface ConfigSourceResult extends ConfigSource {
  loaded: boolean;
}

export interface LoadedAiImgConfig {
  config: AiImgConfig | null;
  sources: ConfigSourceResult[];
}

export interface LoadAiImgConfigOptions {
  cwd?: string;
  sources?: ConfigSource[];
}

export interface ResolvedAiImgRuntimeConfig {
  defaults: {
    provider?: ProviderName;
    model?: string;
    size?: string;
    aspectRatio?: string;
    output: string;
    outDir?: string;
  };
  generate: {
    count: number;
    quality?: (typeof QUALITY_LEVELS)[number];
  };
  edit: {
    count: number;
  };
  batch: {
    concurrency: number;
    maxAttempts: number;
  };
  preview: {
    mode: "off" | "auto" | "on";
    protocol: "auto" | "kitty";
    width?: number;
  };
  secrets: ProviderSecretMap;
}

export const DEFAULT_RUNTIME_CONFIG: ResolvedAiImgRuntimeConfig = {
  defaults: {
    output: "output.png",
  },
  generate: {
    count: 1,
  },
  edit: {
    count: 1,
  },
  batch: {
    concurrency: 5,
    maxAttempts: 3,
  },
  preview: {
    mode: "auto",
    protocol: "auto",
    width: 32,
  },
  secrets: {},
};

function unwrapSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  let current = schema;
  while (
    current instanceof z.ZodOptional ||
    current instanceof z.ZodNullable ||
    current instanceof z.ZodDefault ||
    current instanceof z.ZodCatch ||
    current instanceof z.ZodReadonly
  ) {
    current = (current as unknown as { unwrap: () => z.ZodTypeAny }).unwrap();
  }
  return current;
}

function collectLeafSchemas(
  schema: z.ZodTypeAny,
  prefix: string,
): Array<[EditableConfigKey, z.ZodTypeAny]> {
  const current = unwrapSchema(schema);
  if (current instanceof z.ZodObject) {
    const entries = Object.entries(current.shape) as Array<[string, z.ZodTypeAny]>;
    return entries.flatMap(([key, value]) => collectLeafSchemas(value, `${prefix}.${key}`));
  }
  return [[prefix as EditableConfigKey, current]];
}

function buildLiteralParser(key: EditableConfigKey, schema: z.ZodLiteral): z.ZodTypeAny {
  const values = [...schema.values];
  const literal = values[0];

  if (typeof literal === "number") {
    return z.coerce.number().pipe(schema as z.ZodLiteral<number>);
  }
  if (typeof literal === "boolean") {
    return z.coerce.boolean().pipe(schema as z.ZodLiteral<boolean>);
  }
  if (typeof literal === "string") {
    return schema;
  }
  throw new Error(`Unsupported literal schema for editable key ${key}: ${typeof literal}`);
}

function buildEditableValueSchema(key: EditableConfigKey, schema: z.ZodTypeAny): z.ZodTypeAny {
  if (schema instanceof z.ZodString || schema instanceof z.ZodEnum) {
    return schema;
  }
  if (schema instanceof z.ZodNumber) {
    return z.coerce.number().pipe(schema);
  }
  if (schema instanceof z.ZodBoolean) {
    return z.coerce.boolean().pipe(schema);
  }
  if (schema instanceof z.ZodLiteral) {
    return buildLiteralParser(key, schema);
  }
  throw new Error(`Unsupported editable schema type for key ${key}: ${schema.constructor.name}`);
}

const editableSchemaEntries = collectLeafSchemas(AiImgConfigFileSchema.shape.aiImg, "aiImg");
const schemaVersionEntry = editableSchemaEntries.find(([key]) => key === "aiImg.schemaVersion");
const nonSchemaVersionEntries = editableSchemaEntries.filter(
  ([key]) => key !== "aiImg.schemaVersion",
);
const orderedEditableEntries = schemaVersionEntry
  ? [schemaVersionEntry, ...nonSchemaVersionEntries]
  : nonSchemaVersionEntries;

export const EDITABLE_CONFIG_KEYS = Object.freeze(
  orderedEditableEntries.map(([key]) => key),
) as readonly EditableConfigKey[];

const EDITABLE_KEY_SET = new Set<EditableConfigKey>(EDITABLE_CONFIG_KEYS);
const EDITABLE_KEY_SCHEMAS = new Map<EditableConfigKey, z.ZodTypeAny>(
  orderedEditableEntries.map(([key, schema]) => [key, buildEditableValueSchema(key, schema)]),
);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge<T extends Record<string, unknown>>(
  base: T,
  incoming: Record<string, unknown>,
): T {
  const output: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    const existing = output[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      output[key] = deepMerge(existing, value);
      continue;
    }
    output[key] = value;
  }
  return output as T;
}

function formatIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) {
    return "unknown validation error";
  }
  const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
  return `${path}: ${issue.message}`;
}

function getProjectConfigCandidates(cwd: string): ConfigSource[] {
  return [
    { path: resolve(cwd, ".ai-imgrc"), kind: "project" },
    { path: resolve(cwd, ".ai-imgrc.json"), kind: "project" },
    { path: resolve(cwd, ".ai-imgrc.local.json"), kind: "project" },
  ];
}

export function getUserConfigPath(): string {
  return resolve(homedir(), ".config/ai-img/config.json");
}

export function getDefaultConfigSources(cwd = process.cwd()): ConfigSource[] {
  return [{ path: getUserConfigPath(), kind: "user" }, ...getProjectConfigCandidates(cwd)];
}

export function getDefaultProjectWritePath(cwd = process.cwd()): string {
  return resolve(cwd, ".ai-imgrc.json");
}

export function resolveConfigWritePath(options: {
  target: ConfigTarget;
  cwd?: string;
  file?: string;
}): string {
  const cwd = options.cwd ?? process.cwd();
  if (options.file) {
    return resolve(cwd, options.file);
  }
  return options.target === "user" ? getUserConfigPath() : getDefaultProjectWritePath(cwd);
}

async function readConfigFragment(path: string): Promise<AiImgConfigFile | null> {
  try {
    const content = await readFile(path, "utf-8");
    const parsed = JSON.parse(content) as unknown;
    const result = AiImgConfigFileSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Invalid config file at ${path}: ${formatIssue(result.error)}`);
    }
    return result.data;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      return null;
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in config file at ${path}: ${error.message}`);
    }
    throw error;
  }
}

function normalizeMergedConfig(merged: Record<string, unknown>): Record<string, unknown> {
  const aiImg = merged.aiImg;
  if (!isPlainObject(aiImg) || aiImg.schemaVersion !== undefined) {
    return merged;
  }

  return {
    ...merged,
    aiImg: {
      ...aiImg,
      schemaVersion: 1,
    },
  };
}

export async function loadAiImgConfig(
  options: LoadAiImgConfigOptions = {},
): Promise<LoadedAiImgConfig> {
  const cwd = options.cwd ?? process.cwd();
  const sources = options.sources ?? getDefaultConfigSources(cwd);
  const status: ConfigSourceResult[] = [];
  let merged: Record<string, unknown> = {};

  for (const source of sources) {
    const fragment = await readConfigFragment(source.path);
    status.push({ ...source, loaded: Boolean(fragment) });
    if (fragment) {
      merged = deepMerge(merged, fragment as unknown as Record<string, unknown>);
    }
  }

  if (status.every((source) => !source.loaded)) {
    return { config: null, sources: status };
  }

  const normalized = normalizeMergedConfig(merged);
  const parsed = AiImgConfigSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new Error(`Invalid merged ai-img config: ${formatIssue(parsed.error)}`);
  }

  return { config: parsed.data, sources: status };
}

export function resolveRuntimeConfig(
  config: AiImgConfig | null | undefined,
): ResolvedAiImgRuntimeConfig {
  if (!config) {
    return DEFAULT_RUNTIME_CONFIG;
  }

  const aiImg = config.aiImg;

  return {
    defaults: {
      provider: aiImg.defaults?.provider,
      model: aiImg.defaults?.model,
      size: aiImg.defaults?.size,
      aspectRatio: aiImg.defaults?.aspectRatio,
      output: aiImg.defaults?.output ?? DEFAULT_RUNTIME_CONFIG.defaults.output,
      outDir: aiImg.defaults?.outDir,
    },
    generate: {
      count: aiImg.generate?.count ?? DEFAULT_RUNTIME_CONFIG.generate.count,
      quality: aiImg.generate?.quality,
    },
    edit: {
      count: aiImg.edit?.count ?? DEFAULT_RUNTIME_CONFIG.edit.count,
    },
    batch: {
      concurrency: aiImg.batch?.concurrency ?? DEFAULT_RUNTIME_CONFIG.batch.concurrency,
      maxAttempts: aiImg.batch?.maxAttempts ?? DEFAULT_RUNTIME_CONFIG.batch.maxAttempts,
    },
    preview: {
      mode: aiImg.preview?.mode ?? DEFAULT_RUNTIME_CONFIG.preview.mode,
      protocol: aiImg.preview?.protocol ?? DEFAULT_RUNTIME_CONFIG.preview.protocol,
      width: aiImg.preview?.width ?? DEFAULT_RUNTIME_CONFIG.preview.width,
    },
    secrets: {
      openai: aiImg.secrets?.openai,
      google: aiImg.secrets?.google,
      fal: aiImg.secrets?.fal,
    },
  };
}

export function getProviderSecrets(config: AiImgConfig | null | undefined): ProviderSecretMap {
  return resolveRuntimeConfig(config).secrets;
}

export function isEditableConfigKey(key: string): key is EditableConfigKey {
  return EDITABLE_KEY_SET.has(key as EditableConfigKey);
}

export function parseEditableConfigValue(key: string, rawValue: string): unknown {
  if (!isEditableConfigKey(key)) {
    throw new Error(`Unsupported config key: ${key}`);
  }
  const schema = EDITABLE_KEY_SCHEMAS.get(key);
  if (!schema) {
    throw new Error(`Unsupported config key: ${key}`);
  }
  const result = schema.safeParse(rawValue);
  if (!result.success) {
    throw new Error(`Invalid value for ${key}: ${formatIssue(result.error)}`);
  }
  return result.data;
}

function ensureObject(value: unknown): Record<string, unknown> {
  if (isPlainObject(value)) {
    return value;
  }
  return {};
}

export function setConfigValue(
  input: AiImgConfigFile | Record<string, unknown>,
  key: string,
  value: unknown,
): Record<string, unknown> {
  const root = ensureObject(input);
  const parts = key.split(".");

  let current: Record<string, unknown> = root;
  for (let index = 0; index < parts.length - 1; index++) {
    const part = parts[index];
    current[part] = ensureObject(current[part]);
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
  return root;
}

export function unsetConfigValue(
  input: AiImgConfigFile | Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const root = ensureObject(input);
  const parts = key.split(".");

  const walk = (node: Record<string, unknown>, index: number): boolean => {
    const part = parts[index];
    if (!(part in node)) {
      return Object.keys(node).length === 0;
    }

    if (index === parts.length - 1) {
      delete node[part];
      return Object.keys(node).length === 0;
    }

    const next = node[part];
    if (!isPlainObject(next)) {
      delete node[part];
      return Object.keys(node).length === 0;
    }

    const emptyChild = walk(next, index + 1);
    if (emptyChild) {
      delete node[part];
    }
    return Object.keys(node).length === 0;
  };

  walk(root, 0);
  return root;
}

export async function loadConfigFile(
  path: string,
): Promise<AiImgConfigFile | Record<string, unknown>> {
  const existing = await readConfigFragment(path);
  return existing ?? {};
}

export async function writeConfigFile(path: string, value: Record<string, unknown>): Promise<void> {
  const parsed = AiImgConfigFileSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Refusing to write invalid config to ${path}: ${formatIssue(parsed.error)}`);
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(parsed.data, null, 2)}\n`, "utf-8");
}

export function createInitialConfig(): AiImgConfig {
  return {
    aiImg: {
      schemaVersion: 1,
      defaults: {
        output: DEFAULT_RUNTIME_CONFIG.defaults.output,
      },
      generate: {
        count: DEFAULT_RUNTIME_CONFIG.generate.count,
      },
      edit: {
        count: DEFAULT_RUNTIME_CONFIG.edit.count,
      },
      batch: {
        concurrency: DEFAULT_RUNTIME_CONFIG.batch.concurrency,
        maxAttempts: DEFAULT_RUNTIME_CONFIG.batch.maxAttempts,
      },
      preview: {
        mode: DEFAULT_RUNTIME_CONFIG.preview.mode,
        protocol: DEFAULT_RUNTIME_CONFIG.preview.protocol,
        width: DEFAULT_RUNTIME_CONFIG.preview.width,
      },
      secrets: {},
    },
  };
}

export function redactSecrets(config: AiImgConfig): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
  const secrets = (clone.aiImg as Record<string, unknown>)?.secrets as
    | Record<string, unknown>
    | undefined;
  if (secrets) {
    for (const key of Object.keys(secrets)) {
      if (typeof secrets[key] === "string" && (secrets[key] as string).length > 0) {
        secrets[key] = "***redacted***";
      }
    }
  }
  return clone;
}
