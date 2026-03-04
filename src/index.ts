import { createCLI } from "@bunli/core";
import { configMergerPlugin } from "@bunli/plugin-config";
import { completionsPlugin } from "@bunli/plugin-completions";
import { resolve } from "path";
import { generateCommand } from "./commands/generate";
import { editCommand } from "./commands/edit";
import { batchCommand } from "./commands/batch";
import { statusCommand } from "./commands/status";
import { configCommand } from "./commands/config";
import pkg from "../package.json" with { type: "json" };

const commandName = Object.keys(pkg.bin ?? {})[0] ?? "ai-img";
const generatedPath = resolve(import.meta.dir, "..", ".bunli/commands.gen.ts");

const cli = await createCLI({
  name: "ai-img",
  version: pkg.version,
  description: "AI Image Generation CLI",
  plugins: [
    configMergerPlugin({
      sources: [
        "~/.config/{{name}}/config.json",
        ".{{name}}rc",
        ".{{name}}rc.json",
        ".{{name}}rc.local.json",
      ],
      mergeStrategy: "deep",
    }),
    completionsPlugin({
      generatedPath,
      commandName,
      executable: commandName,
      includeAliases: true,
      includeGlobalFlags: true,
    }),
  ],
});

// Register commands
cli.command(generateCommand);
cli.command(editCommand);
cli.command(batchCommand);
cli.command(statusCommand);
cli.command(configCommand);

// Run the CLI
await cli.run();
