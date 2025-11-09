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
        // Industry-standard severity color scheme
        const color =
          f.severity === "critical"
            ? chalk.red.bold        // Critical: Bold Red
            : f.severity === "high"
            ? chalk.red              // High: Red
            : f.severity === "medium"
            ? chalk.yellow           // Medium: Yellow
            : chalk.gray;            // Low: Gray

        const lineInfo = f.line ? ` (line ${f.line})` : "";
        console.log(
          color(
            `  ├─ [${f.rule}] ${f.message}${lineInfo} (${f.severity.toUpperCase()})`
          )
        );
      }
    }
  }

  console.log(chalk.cyan.bold(`\n✅ Total issues: ${findings.length}`));
  
  // Inter-service security summary
  printInterServiceSummary(findings);
  console.log(); // Extra newline
}

/**
 * Print inter-service communication vulnerability summary
 */
function printInterServiceSummary(findings) {
  // Define inter-service communication rules
  const interServiceRules = [
    'MISSING_SERVICE_AUTH',
    'MISSING_MESSAGE_VALIDATION',
    'KAFKA_MISSING_SCHEMA_VALIDATION',
    'EXCESSIVE_SERVICE_TRUST',
    'MISSING_MUTUAL_TLS',
    'SHARED_BROKER_CREDENTIALS',
    'MISSING_CIRCUIT_BREAKER',
    'MISSING_REQUEST_SIGNING',
    'SERVICE_REGISTRY_POISONING',
    'MISSING_QUEUE_AUTHORIZATION',
    'MISSING_MESSAGE_ENCRYPTION',
    'EXPOSED_INTERNAL_PORT',
    'UNENCRYPTED_SERVICE_MESH',
    'EGRESS_INSECURE_HTTP',
    'EGRESS_INSECURE_RABBITMQ',
    'EGRESS_INSECURE_KAFKA',
    'PLAINTEXT_BROKER',
    'KAFKA_PLAINTEXT',
    'KAFKA_MISSING_SASL'
  ];
  
  // Filter inter-service findings
  const interServiceFindings = findings.filter(f => interServiceRules.includes(f.rule));
  
  if (interServiceFindings.length === 0) {
    return; // No inter-service issues
  }
  
  // Group by rule and count
  const byRule = interServiceFindings.reduce((acc, f) => {
    acc[f.rule] = (acc[f.rule] || 0) + 1;
    return acc;
  }, {});
  
  // Sort by count (descending)
  const sortedRules = Object.entries(byRule).sort((a, b) => b[1] - a[1]);
  
  console.log(chalk.yellow.bold('\n📊 Inter-Service Security Summary:'));
  console.log(chalk.yellow(`   Total Inter-Service Issues: ${interServiceFindings.length}`));
  console.log(chalk.gray('   ─'.repeat(40)));
  
  sortedRules.forEach(([rule, count]) => {
    const finding = findings.find(f => f.rule === rule);
    const severity = finding?.severity || 'unknown';
    
    // Industry-standard color scheme
    const severityColor = severity === 'critical' ? chalk.red.bold :
                          severity === 'high' ? chalk.red :
                          severity === 'medium' ? chalk.yellow : 
                          severity === 'low' ? chalk.gray : chalk.gray;
    
    const severityBadge = severity === 'critical' ? '🔴' :
                          severity === 'high' ? '🟠' :
                          severity === 'medium' ? '🟡' : 
                          severity === 'low' ? '⚪' : '⚪';
    
    console.log(`   ${severityBadge} ${severityColor(rule)}: ${chalk.white(count)}`);
  });
}
