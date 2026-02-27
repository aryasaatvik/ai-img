import { createCLI } from "@bunli/core";
import { generateCommand } from "./commands/generate";
import { editCommand } from "./commands/edit";
import { batchCommand } from "./commands/batch";
import { statusCommand } from "./commands/status";
import pkg from "../package.json" with { type: "json" };

const cli = await createCLI({
  name: "ai-img",
  version: pkg.version,
  description: "AI Image Generation CLI",
});

// Register commands
cli.command(generateCommand);
cli.command(editCommand);
cli.command(batchCommand);
cli.command(statusCommand);

// Run the CLI
await cli.run();
