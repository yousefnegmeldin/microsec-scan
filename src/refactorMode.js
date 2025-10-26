/**
 * Refactor Mode - Generate markdown prompts from scan results
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { runScanner } from './scanner.js';
import { PromptGenerator } from './refactor/PromptGenerator.js';
import { CodeRemediation } from './refactor/CodeRemediation.js';

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

/**
 * Run LLM-based auto-fix mode
 */
export async function runAutoFix(options) {
  console.log(chalk.cyan.bold('\n🤖 MicroSec-Scan Auto-Fix Mode\n'));
  
  // Validate API key
  if (!options.apiKey) {
    console.error(chalk.red('❌ Error: API key required'));
    console.log(chalk.gray(`\nProvider: ${options.provider || 'groq'}`));
    console.log(chalk.gray('\nSet your API key:'));
    console.log(chalk.gray('  export OPENROUTER_API_KEY="sk-or-v1-..."  (for OpenRouter)'));
    console.log(chalk.gray('  export GROQ_API_KEY="gsk_..."  (for Groq)'));
    console.log(chalk.gray('  or use: --api-key your-key-here\n'));
    process.exit(1);
  }
  
  if (options.verbose) {
    console.log(chalk.gray(`Using provider: ${options.provider || 'groq'}`));
    console.log(chalk.gray(`API key found: ${options.apiKey.substring(0, 20)}...`));
  }
  
  // Step 1: Run scan to get findings
  console.log(chalk.cyan('Step 1/3: Scanning for vulnerabilities...'));
  
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
  
  // Save baseline
  const outputDir = path.resolve(options.output);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const baselinePath = path.join(outputDir, 'baseline.json');
  fs.writeFileSync(baselinePath, JSON.stringify(scanResults, null, 2));
  console.log(chalk.gray(`   Baseline saved: ${baselinePath}\n`));
  
  // Step 2: Generate LLM fixes
  console.log(chalk.cyan('Step 2/3: Generating fixes with LLM...'));
  
  const remediation = new CodeRemediation(options.apiKey, {
    provider: options.provider || 'groq',
    model: options.model,
    temperature: 0.1,
    verbose: options.verbose,
    interactive: options.interactive,
    maxConcurrent: 3,
    rateLimitMs: options.rateLimitMs || 1000
  });
  
  const result = await remediation.generateRemediation(
    scanResults,
    path.resolve(options.path),
    outputDir
  );
  
  // Step 3: Display results
  console.log(chalk.cyan('\nStep 3/3: Results\n'));
  
  if (!result || !result.stats) {
    console.log(chalk.red('❌ No fixes were generated. Check errors above.\n'));
    return;
  }
  
  console.log(chalk.bold('Statistics:'));
  console.log(`  Total issues: ${result.stats.totalFindings}`);
  console.log(`  Fixes generated: ${chalk.green(result.stats.fixesGenerated)}`);
  console.log(`  Success rate: ${chalk.green(result.stats.successRate)}`);
  console.log(`  Confidence: High=${chalk.green(result.stats.confidenceBreakdown.high)} Medium=${chalk.yellow(result.stats.confidenceBreakdown.medium)} Low=${chalk.red(result.stats.confidenceBreakdown.low)}`);
  console.log(`  Tokens used: ${result.stats.totalTokens.toLocaleString()}`);
  console.log(`  Estimated cost: $${result.stats.estimatedCost}\n`);
  
  if (result.errors.length > 0) {
    console.log(chalk.yellow(`⚠️  ${result.errors.length} errors occurred (see logs)\n`));
  }
  
  // Display output information
  console.log(chalk.bold.cyan('📦 Output Files:\n'));
  console.log(chalk.gray(`  ${outputDir}/`));
  console.log(chalk.gray(`  ├── fixed_files/          # Fixed source files`));
  console.log(chalk.gray(`  ├── apply-fixes.sh        # Apply all fixes`));
  console.log(chalk.gray(`  ├── rollback.sh           # Rollback changes`));
  console.log(chalk.gray(`  ├── FIXES_SUMMARY.md      # Quick reference`));
  console.log(chalk.gray(`  ├── REMEDIATION_REPORT.md # Detailed report`));
  console.log(chalk.gray(`  └── baseline.json         # Original findings\n`));
  
  console.log(chalk.bold.green('✅ Fixes generated successfully!\n'));
  
  console.log(chalk.bold('Next steps:\n'));
  console.log(`  1. Review fixes: ${chalk.cyan(`cat ${outputDir}/FIXES_SUMMARY.md`)}`);
  console.log(`  2. Apply fixes:  ${chalk.cyan(`cd ${outputDir} && ./apply-fixes.sh`)}`);
  console.log(`  3. Test your app`);
  console.log(`  4. Re-scan:      ${chalk.cyan(`microsec-scan scan -p ${options.path}`)}`);
  console.log(`  5. If needed:    ${chalk.cyan(`cd ${outputDir} && ./rollback.sh`)}\n`);
  
  return result;
}
