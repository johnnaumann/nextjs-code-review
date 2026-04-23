import type { Command } from "commander";

export type WorkflowRegistration = (program: Command) => void;

export function registerWorkflow(program: Command, register: WorkflowRegistration) {
  register(program);
}

