import fs from "fs";
import path from "path";
import chalk from "chalk";
import { glob } from "glob";
import { analyzeSource } from "./parsers/ASTCodeParser.js";
import { analyzeCompose } from "./parsers/composeParser.js";
import { analyzeMicroservice } from "./parsers/microserviceParser.js";
import { EgressReporter } from "./egress/EgressReporter.js";

/**
 * Main scanner function that orchestrates the security scanning process.
 */
export async function runScanner({ path: baseDir, format, output, verbose, showRoutes, showEgress }) {
  const findings = [];

  console.log(chalk.gray(`📂 Scanning directory: ${baseDir}`));

  const files = await glob(`${baseDir}/**/*`, {
    ignore: [
      "**/node_modules/**", 
      "**/dist/**",
      "**/.git/**",
      "**/build/**",
      "**/coverage/**"
    ],
    nodir: true,
    absolute: true,
  });

  const filteredFiles = files.filter(file => {
    return !file.includes('/node_modules/') && 
           !file.includes('/dist/') && 
           !file.includes('/.git/') &&
           !file.includes('/build/') &&
           !file.includes('/coverage/');
  });

  if (verbose) {
    console.log(chalk.gray(`📁 Found ${filteredFiles.length} files to analyze\n`));
  }

  // Detect microservice directories (directories with package.json)
  const serviceDirs = new Set();
  for (const file of filteredFiles) {
    if (file.endsWith("package.json")) {
      serviceDirs.add(path.dirname(file));
    }
  }

  // Analyze each microservice directory
  for (const serviceDir of serviceDirs) {
    try {
      const serviceName = path.basename(serviceDir);
      if (verbose) console.log(chalk.cyan(`\n🔍 Analyzing service: ${serviceName}`));
      const results = analyzeMicroservice(serviceDir, verbose, showRoutes, showEgress);
      if (results.length > 0) {
        console.log(chalk.yellow(`   ⚠️  Found ${results.length} security issues`));
      } else if (verbose) {
        console.log(chalk.green(`   ✓ No issues found`));
      }
      findings.push(...results);
    } catch (err) {
      if (verbose)
        console.error(chalk.red(`   ✗ Error: ${err.message}`));
    }
  }

  // Analyze individual files (only show in verbose mode, no per-file output)
  let jsFilesAnalyzed = 0;
  let composeFilesAnalyzed = 0;
  
  for (const file of filteredFiles) {
    try {
      if (file.endsWith(".js") || file.endsWith(".ts")) {
        jsFilesAnalyzed++;
        const results = analyzeSource(file, false); // Don't pass verbose to avoid spam
        findings.push(...results);
      } else if (file.includes("docker-compose")) {
        composeFilesAnalyzed++;
        findings.push(...analyzeCompose(file, false)); // Don't pass verbose
      }
    } catch (err) {
      if (verbose)
        console.error(chalk.red(`   ✗ Error parsing ${path.basename(file)}: ${err.message}`));
    }
  }
  
  if (verbose && (jsFilesAnalyzed > 0 || composeFilesAnalyzed > 0)) {
    console.log(chalk.gray(`\n📊 Analyzed ${jsFilesAnalyzed} JS/TS files and ${composeFilesAnalyzed} Docker Compose files`));
  }

  if (format === "json") {
    const json = JSON.stringify(findings, null, 2);
    if (output) fs.writeFileSync(output, json);
    console.log(json);
  } else {
    printFindings(findings);
  }

  console.log(
    chalk.cyan.bold(`✅ Scan complete: ${findings.length} issues found.\n`)
  );
  
  return findings;
}

/**
 * Formats and prints security findings to the console.
 */
function printFindings(findings) {
  if (!findings.length) {
    console.log(chalk.green("✅ No issues found.\n"));
    return;
  }

  console.log("\n" + chalk.bold.cyan("=== Security Scan Report ==="));

  const groupedByFile = findings.reduce((acc, f) => {
    acc[f.file] = acc[f.file] || [];
    acc[f.file].push(f);
    return acc;
  }, {});

  for (const [file, fileFindings] of Object.entries(groupedByFile)) {
    console.log(chalk.bold.gray(`\n📄 ${file}`));

    const groupedByRule = fileFindings.reduce((acc, f) => {
      acc[f.rule] = acc[f.rule] || [];
      acc[f.rule].push(f);
      return acc;
    }, {});

    const sortedRules = Object.keys(groupedByRule).sort();

    for (const rule of sortedRules) {
      const issues = groupedByRule[rule].sort(
        (a, b) => (a.line || 0) - (b.line || 0)
      );

      for (const f of issues) {
        const color =
          f.severity === "high"
            ? chalk.redBright
            : f.severity === "medium"
            ? chalk.yellowBright
            : chalk.greenBright;

        const lineInfo = f.line ? ` (line ${f.line})` : "";
        console.log(
          color(
            `  ├─ [${f.rule}] ${f.message}${lineInfo} (${f.severity.toUpperCase()})`
          )
        );
      }
    }
  }

  console.log(chalk.cyan.bold(`\n✅ Total issues: ${findings.length}\n`));
}
