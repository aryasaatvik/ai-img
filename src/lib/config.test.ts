import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { basename, join } from "path";
import { z } from "zod";
import {
  AiImgConfigSchema,
  EDITABLE_CONFIG_KEYS,
  createInitialConfig,
  getDefaultConfigSources,
  getUserConfigPath,
  isEditableConfigKey,
  loadAiImgConfig,
  parseEditableConfigValue,
  redactSecrets,
  resolveRuntimeConfig,
  setConfigValue,
  unsetConfigValue,
  writeConfigFile,
  type ConfigSource,
} from "./config";

async function makeTempDir(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

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

function collectLeafPaths(schema: z.ZodTypeAny, prefix = ""): string[] {
  const current = unwrapSchema(schema);
  if (current instanceof z.ZodObject) {
    return Object.entries(current.shape).flatMap(([key, value]) =>
      collectLeafPaths(value, prefix ? `${prefix}.${key}` : key)
    );
  }
  return [prefix];
}

describe("config runtime resolution", () => {
  test("returns code defaults when config is missing", () => {
    const resolved = resolveRuntimeConfig(null);
    expect(resolved.defaults.size).toBe("1024x1024");
    expect(resolved.defaults.output).toBe("output.png");
    expect(resolved.generate.count).toBe(1);
    expect(resolved.batch.concurrency).toBe(5);
    expect(resolved.preview.mode).toBe("auto");
    expect(resolved.preview.protocol).toBe("auto");
    expect(resolved.preview.width).toBe(32);
  });

  test("merges user + project sources with project precedence", async () => {
    const cwd = await makeTempDir("ai-img-config-");
    const userPath = join(cwd, "user.json");
    const projectPath = join(cwd, "project.json");

    await writeJson(userPath, {
      aiImg: {
        schemaVersion: 1,
        defaults: {
          provider: "openai",
          output: "user.png",
          size: "512x512",
        },
        generate: {
          count: 2,
        },
      },
    });

    await writeJson(projectPath, {
      aiImg: {
        defaults: {
          output: "project.png",
        },
        batch: {
          concurrency: 9,
        },
      },
    });

    const sources: ConfigSource[] = [
      { path: userPath, kind: "user" },
      { path: projectPath, kind: "project" },
    ];

    const loaded = await loadAiImgConfig({ cwd, sources });
    expect(loaded.config).not.toBeNull();
    const resolved = resolveRuntimeConfig(loaded.config);

    expect(resolved.defaults.provider).toBe("openai");
    expect(resolved.defaults.output).toBe("project.png");
    expect(resolved.defaults.size).toBe("512x512");
    expect(resolved.generate.count).toBe(2);
    expect(resolved.batch.concurrency).toBe(9);
    expect(resolved.preview.mode).toBe("auto");
    expect(resolved.preview.width).toBe(32);
  });

  test("default source order is user then project candidates", () => {
    const cwd = "/tmp/ai-img-order";
    const sources = getDefaultConfigSources(cwd);

    expect(sources[0]?.path).toBe(getUserConfigPath());
    expect(basename(sources[1]?.path ?? "")).toBe(".ai-imgrc");
    expect(basename(sources[2]?.path ?? "")).toBe(".ai-imgrc.json");
    expect(basename(sources[3]?.path ?? "")).toBe(".ai-imgrc.local.json");
  });

  test("normalizes schemaVersion to 1 when omitted in loaded files", async () => {
    const cwd = await makeTempDir("ai-img-schema-version-");
    const projectPath = join(cwd, "project.json");
    await writeJson(projectPath, {
      aiImg: {
        defaults: {
          output: "project.png",
        },
      },
    });

    const loaded = await loadAiImgConfig({
      cwd,
      sources: [{ path: projectPath, kind: "project" }],
    });

    expect(loaded.config?.aiImg.schemaVersion).toBe(1);
    expect(loaded.config?.aiImg.defaults?.output).toBe("project.png");
  });
});

describe("config validation + mutators", () => {
  test("fails on malformed JSON", async () => {
    const cwd = await makeTempDir("ai-img-json-");
    const broken = join(cwd, "broken.json");
    await writeFile(broken, "{not valid json", "utf-8");

    const sources: ConfigSource[] = [{ path: broken, kind: "project" }];

    await expect(loadAiImgConfig({ cwd, sources })).rejects.toThrow("Invalid JSON");
  });

  test("fails on strict-schema unknown keys", async () => {
    const cwd = await makeTempDir("ai-img-strict-");
    const invalid = join(cwd, "invalid.json");
    await writeJson(invalid, {
      aiImg: {
        schemaVersion: 1,
        defaults: {
          output: "ok.png",
          unexpected: true,
        },
      },
    });

    const sources: ConfigSource[] = [{ path: invalid, kind: "project" }];
    await expect(loadAiImgConfig({ cwd, sources })).rejects.toThrow("Unrecognized key");
  });

  test("editable value parsing validates and coerces", () => {
    const schemaLeafPaths = collectLeafPaths(AiImgConfigSchema)
      .filter((path) => path.startsWith("aiImg."))
      .map((path) => path as (typeof EDITABLE_CONFIG_KEYS)[number]);

    expect(new Set(EDITABLE_CONFIG_KEYS)).toEqual(
      new Set(schemaLeafPaths)
    );
    expect(EDITABLE_CONFIG_KEYS[0]).toBe("aiImg.schemaVersion");
    expect(isEditableConfigKey("aiImg.defaults")).toBe(false);
    expect(isEditableConfigKey("aiImg.defaults.output")).toBe(true);

    expect(parseEditableConfigValue("aiImg.batch.concurrency", "3")).toBe(3);
    expect(parseEditableConfigValue("aiImg.preview.mode", "on")).toBe("on");
    expect(parseEditableConfigValue("aiImg.schemaVersion", "1")).toBe(1);
    expect(() => parseEditableConfigValue("aiImg.batch.concurrency", "0")).toThrow(
      "Invalid value"
    );
    expect(() => parseEditableConfigValue("aiImg.defaults.size", "1024")).toThrow(
      "Invalid value"
    );
    expect(() => parseEditableConfigValue("aiImg.schemaVersion", "2")).toThrow("Invalid value");
  });

  test("set/unset update nested paths and prune empty objects", () => {
    const base = { aiImg: { schemaVersion: 1 } };
    const withValue = setConfigValue(base, "aiImg.defaults.output", "custom.png");
    expect((withValue.aiImg as Record<string, unknown>).defaults).toEqual({
      output: "custom.png",
    });

    const removed = unsetConfigValue(withValue, "aiImg.defaults.output");
    expect((removed.aiImg as Record<string, unknown>).defaults).toBeUndefined();
  });

  test("writeConfigFile rejects invalid config objects", async () => {
    const cwd = await makeTempDir("ai-img-write-");
    const path = join(cwd, "out.json");
    await expect(writeConfigFile(path, {})).rejects.toThrow("Refusing to write invalid config");
  });

  test("createInitialConfig + redactSecrets produce expected shape", async () => {
    const initial = createInitialConfig();
    expect(initial.aiImg.schemaVersion).toBe(1);

    const withSecret = setConfigValue(initial, "aiImg.secrets.openai", "sk-test");
    const redacted = redactSecrets(withSecret as typeof initial);
    const secrets = (redacted.aiImg as Record<string, unknown>).secrets as Record<
      string,
      unknown
    >;
    expect(secrets.openai).toBe("***redacted***");
  });

  test("writeConfigFile writes valid config", async () => {
    const cwd = await makeTempDir("ai-img-write-valid-");
    const path = join(cwd, "config.json");
    const initial = createInitialConfig();
    await writeConfigFile(path, initial);
    const written = await readFile(path, "utf-8");
    expect(written).toContain("\"schemaVersion\": 1");
  });
});
