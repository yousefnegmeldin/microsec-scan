#!/usr/bin/env node

const REQUIRED_NODE_VERSION = 18;
const currentVersion = process.versions.node;
const majorVersion = parseInt(currentVersion.split('.')[0], 10);

if (majorVersion < REQUIRED_NODE_VERSION) {
  console.error(
    `\x1b[31mError: Node.js ${REQUIRED_NODE_VERSION} or higher is required.\x1b[0m\n` +
    `You are currently running Node.js ${currentVersion}.\n`
  );
  process.exit(1);
}

import { program } from "commander";
import chalk from "chalk";
import { runScanner } from "../src/scanner.js";
import { runRefactorMode, compareMetrics } from "../src/refactorMode.js";

program
  .name("microsec-scan")
  .description("Static security scanner for Node.js microservices")
  .version("1.0.0");

// Scan command
program
  .command("scan")
  .description("Scan project for security vulnerabilities")
  .requiredOption("-p, --path <dir>", "Project directory to scan")
  .option("-f, --format <type>", "Output format (json|console)", "console")
  .option("-o, --output <file>", "Optional report output file", "")
  .option("-v, --verbose", "Enable detailed logs", false)
  .option("-r, --show-routes", "Display route analysis table", false)
  .option("-e, --show-egress", "Display egress/output connections", false)
  .action(async (options) => {
    console.log(chalk.cyan.bold(`🚀 Scanning ${options.path} ...`));
    await runScanner(options);
  });

// Refactor command
program
  .command("refactor")
  .description("Generate LLM prompts for fixing security issues")
  .requiredOption("-p, --path <dir>", "Project directory to scan")
  .option("-o, --output <dir>", "Output directory", "./refactor_output")
  .option("-v, --verbose", "Enable detailed logs", false)
  .action(async (options) => {
    await runRefactorMode(options);
  });

// Compare command
program
  .command("compare")
  .description("Compare security metrics")
  .requiredOption("-b, --baseline <file>", "Baseline scan results (JSON)")
  .requiredOption("-c, --current <file>", "Current scan results (JSON)")
  .option("-o, --output <dir>", "Output directory", "./metrics")
  .action(async (options) => {
    await compareMetrics(options);
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
