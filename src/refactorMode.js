/**
 * Refactor Mode - Generate markdown prompts from scan results
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { runScanner } from './scanner.js';
import { PromptGenerator } from './refactor/PromptGenerator.js';

/**
 * Run refactor mode
 */
export async function runRefactorMode(options) {
  console.log(chalk.cyan.bold('\n🔧 MicroSec-Scan Refactor Mode\n'));
  
  // Step 1: Run scan to get findings
  console.log(chalk.cyan('Step 1/2: Scanning for vulnerabilities...'));
  
  const scanResults = await runScanner({
    path: options.path,
    format: 'json',
    output: '',
    verbose: options.verbose,
    showRoutes: false,
    showEgress: false
  });
  
  if (!scanResults || scanResults.length === 0) {
    console.log(chalk.green('\n✅ No security issues found!\n'));
    return;
  }
  
  console.log(chalk.yellow(`   Found ${scanResults.length} issues\n`));
  
  // Step 2: Generate prompts
  console.log(chalk.cyan('Step 2/2: Generating prompts...'));
  
  const generator = new PromptGenerator(scanResults);
  const markdown = generator.generate();
  
  // Save outputs
  const outputDir = path.resolve(options.output);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Save markdown
  const mdPath = path.join(outputDir, 'PROMPTS.md');
  fs.writeFileSync(mdPath, markdown);
  
  // Save JSON
  const jsonPath = path.join(outputDir, 'findings.json');
  fs.writeFileSync(jsonPath, JSON.stringify(scanResults, null, 2));
  
  console.log(chalk.green(`   ✓ Markdown: ${mdPath}`));
  console.log(chalk.green(`   ✓ JSON: ${jsonPath}`));
  
  console.log(chalk.cyan.bold('\n✅ Done!\n'));
  console.log(chalk.gray(`Open: ${mdPath}\n`));
  
  return { markdown, findings: scanResults };
}

/**
 * Compare metrics
 */
export async function compareMetrics(options) {
  const baselineFile = options.baseline;
  const currentFile = options.current;
  const outputDir = options.output;

  if (!fs.existsSync(baselineFile)) {
    console.error(chalk.red(`❌ Baseline not found: ${baselineFile}`));
    process.exit(1);
  }

  if (!fs.existsSync(currentFile)) {
    console.error(chalk.red(`❌ Current not found: ${currentFile}`));
    process.exit(1);
  }

  const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf-8'));
  const current = JSON.parse(fs.readFileSync(currentFile, 'utf-8'));

  const baselineCount = Array.isArray(baseline) ? baseline.length : baseline.findings?.length || 0;
  const currentCount = Array.isArray(current) ? current.length : current.findings?.length || 0;

  console.log(chalk.cyan.bold('\n📊 Comparison\n'));
  console.log(chalk.bold('Baseline: ') + chalk.yellow(baselineCount));
  console.log(chalk.bold('Current:  ') + chalk.yellow(currentCount));
  
  const fixed = baselineCount - currentCount;
  const improvement = baselineCount > 0 ? ((fixed / baselineCount) * 100).toFixed(1) : 0;

  if (fixed > 0) {
    console.log(chalk.bold('Fixed:    ') + chalk.green(fixed));
    console.log(chalk.bold('Improved: ') + chalk.green(`${improvement}%\n`));
  } else if (fixed < 0) {
    console.log(chalk.bold('New:      ') + chalk.red(Math.abs(fixed) + '\n'));
  } else {
    console.log(chalk.bold('Status:   ') + chalk.yellow('No change\n'));
  }

  // Save
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const report = {
    timestamp: new Date().toISOString(),
    baseline: { file: baselineFile, issues: baselineCount },
    current: { file: currentFile, issues: currentCount },
    comparison: {
      fixed,
      improvement: `${improvement}%`,
      status: fixed > 0 ? 'IMPROVED' : fixed < 0 ? 'DEGRADED' : 'NO_CHANGE'
    }
  };

  const reportPath = path.join(outputDir, 'comparison.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(chalk.gray(`Saved: ${reportPath}\n`));
}
