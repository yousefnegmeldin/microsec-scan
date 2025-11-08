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
import { runRefactorMode, compareMetrics, runAutoFix } from "../src/refactorMode.js";

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

// Fix command (LLM-based auto-fix)
program
  .command("fix")
  .description("Generate automated fixes using LLM")
  .requiredOption("-p, --path <dir>", "Project directory to scan")
  .option("-o, --output <dir>", "Output directory for patches", "./fixes")
  .option("--provider <name>", "LLM provider: groq, openrouter, together, openai (will prompt if not specified)")
  .option("--api-key <key>", "API key (or set provider-specific env var)")
  .option("--model <name>", "LLM model to use (provider-specific)")
  .option("-i, --interactive", "Select files interactively", true)
  .option("--all", "Process all files without prompting", false)
  .option("-v, --verbose", "Enable detailed logs", false)
  .option("--rate-limit-ms <ms>", "Delay between API calls (ms)", "1000")
  .action(async (options) => {
    // Use env var if API key not provided
    if (!options.apiKey) {
      options.apiKey = process.env.LLM_API_KEY || 
                      process.env.GROQ_API_KEY ||
                      process.env.OPENROUTER_API_KEY ||
                      process.env.TOGETHER_API_KEY ||
                      process.env.OPENAI_API_KEY;
    }
    // If --all is specified, disable interactive
    if (options.all) {
      options.interactive = false;
    }
    await runAutoFix(options);
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
