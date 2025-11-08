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
  console.log(chalk.cyan('Step 1/2: Scanning for vulnerabilities...\n'));
  
  const scanResults = await runScanner({
    path: options.path,
    format: 'console',
    output: '',
    verbose: false, // Don't spam verbose logs
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
 * Prompt user to select LLM provider
 */
async function promptForProvider() {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise(resolve => rl.question(query, resolve));

  console.log(chalk.cyan.bold('🤖 Select LLM Provider\n'));
  console.log(chalk.gray('═'.repeat(60)));
  
  const providers = [
    { value: 'groq', name: 'Groq', model: 'llama-3.1-70b-versatile', cost: 'FREE (rate limited)', speed: '⚡ Very Fast' },
    { value: 'openrouter', name: 'OpenRouter', model: 'meta-llama/llama-3.1-70b-instruct', cost: '$0.52/1M tokens', speed: '⚡ Fast' },
    { value: 'together', name: 'Together AI', model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', cost: '$0.88/1M tokens', speed: '⚡ Fast' },
    { value: 'openai', name: 'OpenAI', model: 'gpt-4o-mini', cost: '$0.15/1M tokens', speed: '🐢 Slower but high quality' }
  ];
  
  providers.forEach((p, idx) => {
    console.log(`\n${chalk.bold.white(idx + 1 + '.')} ${chalk.cyan(p.name)}`);
    console.log(chalk.gray(`   Model: ${p.model}`));
    console.log(chalk.gray(`   Cost: ${p.cost}`));
    console.log(chalk.gray(`   Speed: ${p.speed}`));
  });
  
  console.log(chalk.gray('\n' + '═'.repeat(60)));
  console.log(chalk.bold('\n💡 Recommendation:'));
  console.log(chalk.gray('  • Start with Groq (free, very fast)'));
  console.log(chalk.gray('  • Use OpenAI for best quality\n'));

  const answer = await question(chalk.cyan('❯ Select provider (1-4): '));
  rl.close();

  const num = parseInt(answer);
  if (num >= 1 && num <= 4) {
    const selected = providers[num - 1];
    console.log(chalk.green(`\n✓ Selected: ${selected.name}\n`));
    return selected.value;
  }

  console.log(chalk.yellow('\nInvalid selection, defaulting to Groq\n'));
  return 'groq';
}

/**
 * Prompt user for API key
 */
async function promptForApiKey(provider) {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise(resolve => rl.question(query, resolve));

  const providerNames = {
    'groq': 'Groq',
    'openrouter': 'OpenRouter',
    'together': 'Together AI',
    'openai': 'OpenAI'
  };

  const signupUrls = {
    'groq': 'https://console.groq.com/keys',
    'openrouter': 'https://openrouter.ai/keys',
    'together': 'https://api.together.xyz/settings/api-keys',
    'openai': 'https://platform.openai.com/api-keys'
  };

  const keyPrefixes = {
    'groq': 'gsk_',
    'openrouter': 'sk-or-v1-',
    'together': '',
    'openai': 'sk-'
  };

  console.log(chalk.yellow.bold(`\n🔑 API Key Required for ${providerNames[provider]}\n`));
  console.log(chalk.gray('Get your API key from:'));
  console.log(chalk.cyan(`   ${signupUrls[provider]}\n`));

  const apiKey = await question(chalk.cyan('❯ Enter your API key: '));
  rl.close();

  if (!apiKey || apiKey.trim().length === 0) {
    console.log(chalk.red('\n❌ API key cannot be empty\n'));
    process.exit(1);
  }

  // Basic validation
  const trimmedKey = apiKey.trim();
  const expectedPrefix = keyPrefixes[provider];
  
  if (expectedPrefix && !trimmedKey.startsWith(expectedPrefix)) {
    console.log(chalk.yellow(`\n⚠️  Warning: API key doesn't start with expected prefix "${expectedPrefix}"`));
    console.log(chalk.yellow('   The key might be invalid, but proceeding anyway...\n'));
  } else {
    console.log(chalk.green('\n✓ API key received\n'));
  }

  return trimmedKey;
}

/**
 * Run LLM-based auto-fix mode
 */
export async function runAutoFix(options) {
  console.log(chalk.cyan.bold('\n🤖 MicroSec-Scan Auto-Fix Mode\n'));
  
  // If provider not specified via CLI, prompt user
  if (!options.provider) {
    options.provider = await promptForProvider();
  }
  
  // Detect API key from environment based on provider
  if (!options.apiKey) {
    const envVars = {
      'groq': 'GROQ_API_KEY',
      'openrouter': 'OPENROUTER_API_KEY',
      'together': 'TOGETHER_API_KEY',
      'openai': 'OPENAI_API_KEY'
    };
    
    const envVar = envVars[options.provider];
    options.apiKey = process.env[envVar];
  }
  
  // If still no API key, prompt user
  if (!options.apiKey) {
    options.apiKey = await promptForApiKey(options.provider);
  }
  
  if (options.verbose) {
    console.log(chalk.gray(`Using provider: ${options.provider || 'groq'}`));
    console.log(chalk.gray(`API key found: ${options.apiKey.substring(0, 20)}...`));
  }
  
  // Step 1: Run scan to get findings
  console.log(chalk.cyan('Step 1/3: Scanning for vulnerabilities...\n'));
  
  const scanResults = await runScanner({
    path: options.path,
    format: 'console', // Use console format, not JSON
    output: '',
    verbose: false, // Don't pass verbose to avoid spam
    showRoutes: false,
    showEgress: false
  });
  
  if (!scanResults || scanResults.length === 0) {
    console.log(chalk.green('\n✅ No security issues found!\n'));
    return;
  }
  
  console.log(chalk.yellow(`   Found ${scanResults.length} issues\n`));
  
  // Save baseline
  // If output is the default "./fixes", put it inside the project directory
  let outputDir;
  if (options.output === './fixes') {
    outputDir = path.join(path.resolve(options.path), 'fixes');
  } else {
    outputDir = path.resolve(options.output);
  }
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  if (options.verbose) {
    console.log(chalk.gray(`   Output directory: ${outputDir}`));
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
  
  // Force exit to prevent hanging
  setTimeout(() => {
    process.exit(0);
  }, 100);
  
  return result;
}
