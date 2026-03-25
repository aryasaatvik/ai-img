import { defineCommand } from "@bunli/core";

import {
  EDITABLE_CONFIG_KEYS,
  isEditableConfigKey,
  loadConfigFile,
  resolveConfigWritePath,
  unsetConfigValue,
  writeConfigFile,
} from "../../lib/config";
import { fileOption, targetOption } from "./options";

export const configUnsetCommand = defineCommand({
  name: "unset",
  description: "Unset a config key (supports dotted paths)",
  options: {
    target: targetOption,
    file: fileOption,
  },
  handler: async ({ flags, positional, cwd }) => {
    const key = positional[0];
    if (!key) {
      throw new Error("Usage: ai-img config unset <key>");
    }
    if (!isEditableConfigKey(key)) {
      throw new Error(
        `Unsupported key: ${key}. Allowed keys:\n- ${EDITABLE_CONFIG_KEYS.join("\n- ")}`,
      );
    }
    if (key === "aiImg.schemaVersion") {
      throw new Error("aiImg.schemaVersion cannot be unset.");
    }

    const path = resolveConfigWritePath({
      target: flags.target,
      cwd,
      file: flags.file,
    });
    const current = await loadConfigFile(path);
    const updated = unsetConfigValue(current, key);
    if (!("aiImg" in updated)) {
      updated.aiImg = {};
    }
    await writeConfigFile(path, updated);
    console.log(`Unset ${key} in ${path}`);
  },
});

export default configUnsetCommand;
