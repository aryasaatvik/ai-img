import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { batchCommand } from "./batch";
import { editCommand } from "./edit";
import { generateCommand } from "./generate";
import { configInitCommand } from "./config/init";
import { configSetCommand } from "./config/set";
import { configShowCommand } from "./config/show";
import { configUnsetCommand } from "./config/unset";

interface TestHandlerArgs<TFlags extends Record<string, unknown>> {
  flags: TFlags;
  positional: string[];
  shell: typeof Bun.$;
  env: typeof process.env;
  cwd: string;
  prompt: {
    password: (message: string) => Promise<string>;
  };
  spinner: Record<string, unknown>;
  colors: Record<string, unknown>;
  terminal: {
    width: number;
    height: number;
    isInteractive: boolean;
    isCI: boolean;
    supportsColor: boolean;
    supportsMouse: boolean;
  };
  runtime: {
    startTime: number;
    args: string[];
    command: string;
  };
}

function makeArgs<TFlags extends Record<string, unknown>>(
  cwd: string,
  flags: TFlags,
  positional: string[] = []
): TestHandlerArgs<TFlags> {
  return {
    flags,
    positional,
    shell: Bun.$,
    env: process.env,
    cwd,
    prompt: {
      password: async () => "secret-from-prompt",
    },
    spinner: {},
    colors: {},
    terminal: {
      width: 120,
      height: 40,
      isInteractive: false,
      isCI: true,
      supportsColor: false,
      supportsMouse: false,
    },
    runtime: {
      startTime: Date.now(),
      args: [],
      command: "test",
    },
  };
}

function mockProcessExit() {
  const calls: number[] = [];
  const original = process.exit;
  const replacement: typeof process.exit = ((code?: number): never => {
    const normalized = code ?? 0;
    calls.push(normalized);
    throw new Error(`__EXIT_${normalized}__`);
  }) as typeof process.exit;
  process.exit = replacement;
  return {
    calls,
    restore() {
      process.exit = original;
    },
  };
}

function captureConsole() {
  const logs: string[] = [];
  const errors: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));
  console.error = (...args: unknown[]) => errors.push(args.map(String).join(" "));
  return {
    logs,
    errors,
    restore() {
      console.log = originalLog;
      console.error = originalError;
    },
  };
}

async function makeTempDir(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

describe("command smoke tests (offline)", () => {
  test("generate exits when prompt is missing", async () => {
    const cwd = await makeTempDir("ai-img-generate-");
    const exit = mockProcessExit();
    const consoleSpy = captureConsole();
    try {
      const handler = generateCommand.handler;
      expect(handler).toBeDefined();
      await expect(
        handler!(
          makeArgs(cwd, {
            prompt: "",
            model: undefined,
            provider: undefined,
            size: undefined,
            aspectRatio: undefined,
            count: undefined,
            seed: undefined,
            quality: undefined,
            output: undefined,
            outDir: undefined,
            "image-mode": undefined,
          }) as unknown as Parameters<NonNullable<typeof generateCommand.handler>>[0]
        )
      ).rejects.toThrow("__EXIT_1__");
      expect(consoleSpy.errors.join("\n")).toContain("--prompt is required");
      expect(exit.calls.at(-1)).toBe(1);
    } finally {
      consoleSpy.restore();
      exit.restore();
    }
  });

  test("edit exits when input is missing", async () => {
    const cwd = await makeTempDir("ai-img-edit-");
    const exit = mockProcessExit();
    const consoleSpy = captureConsole();
    try {
      const handler = editCommand.handler;
      expect(handler).toBeDefined();
      await expect(
        handler!(
          makeArgs(cwd, {
            prompt: "make it blue",
            input: "",
            model: undefined,
            provider: undefined,
            size: undefined,
            count: undefined,
            output: undefined,
            outDir: undefined,
            mask: undefined,
            "image-mode": undefined,
          }) as unknown as Parameters<NonNullable<typeof editCommand.handler>>[0]
        )
      ).rejects.toThrow("__EXIT_1__");
      expect(consoleSpy.errors.join("\n")).toContain("--input is required");
      expect(exit.calls.at(-1)).toBe(1);
    } finally {
      consoleSpy.restore();
      exit.restore();
    }
  });

  test("batch exits when input is missing", async () => {
    const cwd = await makeTempDir("ai-img-batch-");
    const exit = mockProcessExit();
    const consoleSpy = captureConsole();
    try {
      const handler = batchCommand.handler;
      expect(handler).toBeDefined();
      await expect(
        handler!(
          makeArgs(cwd, {
            input: "",
            outDir: undefined,
            concurrency: undefined,
            model: undefined,
            provider: undefined,
            maxAttempts: undefined,
          }) as unknown as Parameters<NonNullable<typeof batchCommand.handler>>[0]
        )
      ).rejects.toThrow("__EXIT_1__");
      expect(consoleSpy.errors.join("\n")).toContain("--input is required");
      expect(exit.calls.at(-1)).toBe(1);
    } finally {
      consoleSpy.restore();
      exit.restore();
    }
  });

  test("config init/set/unset mutates project config as expected", async () => {
    const cwd = await makeTempDir("ai-img-config-flow-");

    await configInitCommand.handler!(
      makeArgs(cwd, { target: "project", file: undefined, force: false }) as unknown as Parameters<
        NonNullable<typeof configInitCommand.handler>
      >[0]
    );

    const configPath = join(cwd, ".ai-imgrc.json");
    const afterInit = JSON.parse(await readFile(configPath, "utf-8")) as {
      aiImg: { schemaVersion: number };
    };
    expect(afterInit.aiImg.schemaVersion).toBe(1);

    await configSetCommand.handler!(
      makeArgs(cwd, { target: "project", file: undefined, secret: false }, [
        "aiImg.defaults.output",
        "custom.png",
      ]) as unknown as Parameters<NonNullable<typeof configSetCommand.handler>>[0]
    );

    const afterSet = JSON.parse(await readFile(configPath, "utf-8")) as {
      aiImg: { defaults?: { output?: string } };
    };
    expect(afterSet.aiImg.defaults?.output).toBe("custom.png");

    await configUnsetCommand.handler!(
      makeArgs(cwd, { target: "project", file: undefined }, [
        "aiImg.defaults.output",
      ]) as unknown as Parameters<NonNullable<typeof configUnsetCommand.handler>>[0]
    );

    const afterUnset = JSON.parse(await readFile(configPath, "utf-8")) as {
      aiImg: { defaults?: Record<string, unknown> };
    };
    expect(afterUnset.aiImg.defaults?.output).toBeUndefined();
  });

  test("config init --force overwrites invalid JSON", async () => {
    const cwd = await makeTempDir("ai-img-config-force-");
    const configPath = join(cwd, ".ai-imgrc.json");
    await writeFile(configPath, "{not valid json", "utf-8");

    await configInitCommand.handler!(
      makeArgs(cwd, { target: "project", file: undefined, force: true }) as unknown as Parameters<
        NonNullable<typeof configInitCommand.handler>
      >[0]
    );

    const content = await readFile(configPath, "utf-8");
    const parsed = JSON.parse(content) as { aiImg: { schemaVersion?: number } };
    expect(parsed.aiImg.schemaVersion).toBe(1);
  });

  test("config show redacts secrets", async () => {
    const cwd = await makeTempDir("ai-img-config-show-");
    const configPath = join(cwd, ".ai-imgrc.json");
    await writeFile(
      configPath,
      JSON.stringify(
        {
          aiImg: {
            schemaVersion: 1,
            defaults: {
              output: "x.png",
              size: "1024x1024",
            },
            generate: { count: 1 },
            edit: { count: 1 },
            batch: { concurrency: 5, maxAttempts: 3 },
            secrets: { openai: "sk-live-secret" },
          },
        },
        null,
        2
      ),
      "utf-8"
    );

    const consoleSpy = captureConsole();
    try {
      await configShowCommand.handler!(
        makeArgs(cwd, {}) as unknown as Parameters<NonNullable<typeof configShowCommand.handler>>[0]
      );
      const output = consoleSpy.logs.join("\n");
      expect(output).toContain("***redacted***");
      expect(output).not.toContain("sk-live-secret");
    } finally {
      consoleSpy.restore();
    }
  });

  test("CLI help smoke includes core commands", async () => {
    const repoRoot = resolve(import.meta.dir, "..", "..");
    const proc = Bun.spawn({
      cmd: ["bun", "run", "src/index.ts", "--help"],
      cwd: repoRoot,
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;

    expect(code).toBe(0);
    expect(stderr.trim()).toBe("");
    expect(stdout).toContain("generate");
    expect(stdout).toContain("edit");
    expect(stdout).toContain("batch");
    expect(stdout).toContain("config");
  });

  test("generate/edit/status help include --image-mode", async () => {
    const repoRoot = resolve(import.meta.dir, "..", "..");
    const commands = [
      ["generate", "--help"],
      ["edit", "--help"],
      ["status", "--help"],
    ] as const;

    for (const args of commands) {
      const proc = Bun.spawn({
        cmd: ["bun", "run", "src/index.ts", ...args],
        cwd: repoRoot,
        stdout: "pipe",
        stderr: "pipe",
      });

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const code = await proc.exited;

      expect(code).toBe(0);
      expect(stderr.trim()).toBe("");
      expect(stdout).toContain("--image-mode");
    }
  });
});
