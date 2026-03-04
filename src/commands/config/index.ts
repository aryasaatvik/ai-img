import { defineGroup } from "@bunli/core";
import { configInitCommand } from "./init";
import { configSetCommand } from "./set";
import { configShowCommand } from "./show";
import { configUnsetCommand } from "./unset";

export const configCommand = defineGroup({
  name: "config",
  description: "Manage ai-img runtime configuration",
  commands: [configInitCommand, configShowCommand, configSetCommand, configUnsetCommand],
});

export default configCommand;
