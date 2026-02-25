import { createCLI } from "@bunli/core";
import { generateCommand } from "./commands/generate";
import { editCommand } from "./commands/edit";
import { batchCommand } from "./commands/batch";

const cli = await createCLI({
  name: "ai-img",
  version: "0.1.0",
  description: "AI Image Generation CLI",
});

// Register commands
cli.command(generateCommand);
cli.command(editCommand);
cli.command(batchCommand);

// Run the CLI
await cli.run();
