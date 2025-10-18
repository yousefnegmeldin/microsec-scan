#!/usr/bin/env node

// Check Node.js version
const REQUIRED_NODE_VERSION = 18;
const currentVersion = process.versions.node;
const majorVersion = parseInt(currentVersion.split('.')[0], 10);

if (majorVersion < REQUIRED_NODE_VERSION) {
  console.error(
    `\x1b[31mError: Node.js ${REQUIRED_NODE_VERSION} or higher is required.\x1b[0m\n` +
    `You are currently running Node.js ${currentVersion}.\n` +
    `Please upgrade your Node.js version: https://nodejs.org/\n`
  );
  process.exit(1);
}

import { program } from "commander";
import chalk from "chalk";
import { runScanner } from "../src/scanner.js";

program
  .name("microsec-scan")
  .description("Static security scanner for Node.js event-driven microservices")
  .version("0.1.0")

  .option("-p, --path <dir>", "Project directory to scan", ".")
  .option("-f, --format <type>", "Output format (json|console)", "console")
  .option("-o, --output <file>", "Optional report output file", "")
  .option("-v, --verbose", "Enable detailed logs", false)
  .option("-r, --show-routes", "Display route analysis table", false)
  .option("-e, --show-egress", "Display egress/output connections", false)

  .action(async (opts) => {
    const { path, format, output, verbose, showRoutes, showEgress } = opts;
    console.log(chalk.cyan.bold(`🚀 Scanning ${path} ...`));
    await runScanner({ path, format, output, verbose, showRoutes, showEgress });
  });

program.parse(process.argv);
