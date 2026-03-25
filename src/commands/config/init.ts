import { defineCommand } from "@bunli/core";

import {
  createInitialConfig,
  loadConfigFile,
  resolveConfigWritePath,
  writeConfigFile,
} from "../../lib/config";
import { fileOption, forceOption, targetOption } from "./options";

export const configInitCommand = defineCommand({
  name: "init",
  description: "Create an ai-img config file",
  options: {
    target: targetOption,
    file: fileOption,
    force: forceOption,
  },
  handler: async ({ flags, cwd }) => {
    const path = resolveConfigWritePath({
      target: flags.target,
      cwd,
      file: flags.file,
    });

    if (flags.force) {
      await writeConfigFile(path, createInitialConfig());
      console.log(`Initialized config at ${path}`);
      return;
    }

    const existing = await loadConfigFile(path);
    const hasExistingData = Object.keys(existing).length > 0;
    if (hasExistingData) {
      throw new Error(
        `Config file already exists at ${path}. Re-run with --force=true to overwrite.`,
      );
    }

    await writeConfigFile(path, createInitialConfig());
    console.log(`Initialized config at ${path}`);
  },
});

export default configInitCommand;
