/**
 * Code Remediation - Orchestrates LLM-based fix generation
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { LLMClient } from './LLMClient.js';
import { DirectFileReplacer } from './DirectFileReplacer.js';

export class CodeRemediation {
  constructor(apiKey, options = {}) {
    this.llmClient = new LLMClient(apiKey, options);
    this.verbose = options.verbose || false;
    this.interactive = options.interactive !== false; // Default true
    this.maxConcurrent = options.maxConcurrent || 3;
    this.rateLimitMs = options.rateLimitMs || 1000;
  }

  /**
   * Generate fixes for all findings (BATCHED by file)
   */
  async generateFixes(findings, projectPath) {
    const fixes = [];
    const errors = [];
    
    console.log(chalk.cyan(`\n🤖 Generating LLM fixes for ${findings.length} issues...\n`));
    
    // Group findings by file
    const byFile = this.groupByFile(findings);
    const fileCount = Object.keys(byFile).length;
    
    // Show file summary and let user select
    const selectedFiles = await this.selectFilesToFix(byFile, projectPath);
    
    if (selectedFiles.length === 0) {
      console.log(chalk.yellow('No files selected. Exiting.\n'));
      return { fixes: [], errors: [] };
    }
    
    console.log(chalk.gray(`\nProcessing ${selectedFiles.length} selected files...\n`));
    
    let processedFiles = 0;
    
    // Process each file's findings in a batch
    for (const [filePath, fileFindings] of Object.entries(byFile)) {
      // Skip if not selected
      if (!selectedFiles.includes(filePath)) {
        continue;
      }
      
      try {
        processedFiles++;
        console.log(chalk.gray(`[${processedFiles}/${selectedFiles.length}] Processing ${path.basename(filePath)} (${fileFindings.length} issues)...`));
        
        // Extract code context for the file
        const context = this.extractFileContext(filePath, fileFindings, projectPath);
        
        if (!context) {
          console.log(chalk.yellow(`  ⚠️  Skipping - unable to extract context`));
          fileFindings.forEach(finding => {
            errors.push({ finding, error: 'Unable to extract context' });
          });
          continue;
        }
        
        // Generate batch fix using LLM (one call for all issues in this file)
        const result = await this.llmClient.generateBatchFixes(fileFindings, context);
        
        // Create fix entries for each finding
        fileFindings.forEach((finding, index) => {
          const fixData = result.fixes[index];
          fixes.push({
            finding,
            before: context.fullFile || context.code,
            after: fixData.code,
            explanation: fixData.explanation,
            confidence: fixData.confidence,
            startLine: 1,
            endLine: (context.fullFile || context.code).split('\n').length,
            model: fixData.model,
            tokensUsed: index === 0 ? result.tokensUsed : 0 // Only count tokens once
          });
        });
        
        // Rate limiting between files
        if (processedFiles < fileCount) {
          await this.delay(this.rateLimitMs);
        }
        
      } catch (error) {
        console.error(chalk.red(`  ✗ Error: ${error.message}`));
        fileFindings.forEach(finding => {
          errors.push({ finding, error: error.message });
        });
      }
    }
    
    console.log(chalk.green(`\n✅ Generated ${fixes.length} fixes from ${processedFiles} API calls`));
    if (errors.length > 0) {
      console.log(chalk.yellow(`⚠️  ${errors.length} errors occurred`));
    }
    
    return { fixes, errors };
  }

  /**
   * Group findings by file
   */
  groupByFile(findings) {
    const grouped = {};
    findings.forEach(finding => {
      const file = finding.file;
      if (!grouped[file]) {
        grouped[file] = [];
      }
      grouped[file].push(finding);
    });
    return grouped;
  }

  /**
   * Interactive file selection
   */
  async selectFilesToFix(byFile, projectPath) {
    const files = Object.entries(byFile);
    
    // If not interactive, return all files
    if (!this.interactive) {
      return files.map(([filePath]) => filePath);
    }

    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (query) => new Promise(resolve => rl.question(query, resolve));

    console.log(chalk.cyan.bold('📋 Files with security issues:\n'));
    files.forEach(([filePath, findings], index) => {
      const relative = path.relative(projectPath, filePath);
      const severity = {
        high: findings.filter(f => f.severity === 'high').length,
        medium: findings.filter(f => f.severity === 'medium').length,
        low: findings.filter(f => f.severity === 'low').length
      };
      
      console.log(chalk.gray(`  ${index + 1}. ${chalk.white(relative)}`));
      console.log(chalk.gray(`     Issues: ${findings.length} (${chalk.red(severity.high + ' high')}, ${chalk.yellow(severity.medium + ' medium')})`));
    });

    console.log();
    console.log(chalk.gray('Options:'));
    console.log(chalk.gray('  • Enter file numbers (e.g., "1,3,5" or "1-5")'));
    console.log(chalk.gray('  • Type "all" to select all files'));
    console.log(chalk.gray('  • Type "none" or press Ctrl+C to skip\n'));

    const answer = await question(chalk.cyan('Select files to fix: '));
    rl.close();

    if (!answer || answer.toLowerCase() === 'none') {
      return [];
    }

    if (answer.toLowerCase() === 'all') {
      return files.map(([filePath]) => filePath);
    }

    // Parse selection (e.g., "1,3,5" or "1-5")
    const selected = [];
    const parts = answer.split(',').map(s => s.trim());
    
    for (const part of parts) {
      if (part.includes('-')) {
        // Range (e.g., "1-5")
        const [start, end] = part.split('-').map(n => parseInt(n.trim()));
        for (let i = start; i <= end; i++) {
          if (i >= 1 && i <= files.length) {
            selected.push(files[i - 1][0]);
          }
        }
      } else {
        // Single number
        const num = parseInt(part);
        if (num >= 1 && num <= files.length) {
          selected.push(files[num - 1][0]);
        }
      }
    }

    return [...new Set(selected)]; // Remove duplicates
  }

  /**
   * Extract context for an entire file
   */
  extractFileContext(filePath, findings, projectPath) {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        const altPath = path.join(projectPath, filePath);
        if (!fs.existsSync(altPath)) {
          return null;
        }
        filePath = altPath;
      }
      
      // Check if it's a directory
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        return this.extractDirectoryContext(findings[0]);
      }
      
      // Read the entire file
      const fullFile = fs.readFileSync(filePath, 'utf-8');
      const lines = fullFile.split('\n');
      
      return {
        filePath,
        code: fullFile,
        fullFile,
        startLine: 1,
        endLine: lines.length,
        totalLines: lines.length
      };
      
    } catch (error) {
      if (this.verbose) {
        console.error(chalk.red(`Error extracting file context: ${error.message}`));
      }
      return null;
    }
  }

  /**
   * Extract code context for a finding
   */
  extractCodeContext(finding, projectPath) {
    try {
      // Check if file exists
      if (!fs.existsSync(finding.file)) {
        // Try relative to project path
        const altPath = path.join(projectPath, finding.file);
        if (!fs.existsSync(altPath)) {
          return null;
        }
        finding.file = altPath;
      }
      
      // Check if it's a directory (microservice-level issue)
      const stats = fs.statSync(finding.file);
      if (stats.isDirectory()) {
        return this.extractDirectoryContext(finding);
      }
      
      // Read the file
      const fileContent = fs.readFileSync(finding.file, 'utf-8');
      const lines = fileContent.split('\n');
      
      // Determine context window
      const contextLines = 15; // Lines before and after
      const lineNum = finding.line || 1;
      
      const startLine = Math.max(1, lineNum - contextLines);
      const endLine = Math.min(lines.length, lineNum + contextLines);
      
      // Extract the code section
      const code = lines.slice(startLine - 1, endLine).join('\n');
      
      // Determine if we need full file context (for imports)
      const needsFullContext = this.needsFullFileContext(finding.rule);
      const fullFile = needsFullContext ? fileContent : null;
      
      return {
        filePath: finding.file,
        code,
        fullFile,
        startLine,
        endLine,
        totalLines: lines.length
      };
      
    } catch (error) {
      if (this.verbose) {
        console.error(chalk.red(`Error extracting context: ${error.message}`));
      }
      return null;
    }
  }

  /**
   * Extract context for directory-level issues (e.g., missing middleware)
   */
  extractDirectoryContext(finding) {
    // Find the main entry point
    const entryPoints = ['index.js', 'app.js', 'main.ts', 'server.js', 'index.ts'];
    const srcDir = path.join(finding.file, 'src');
    
    for (const entry of entryPoints) {
      const entryPath = path.join(finding.file, entry);
      const srcEntryPath = path.join(srcDir, entry);
      
      if (fs.existsSync(entryPath)) {
        finding.file = entryPath;
        return this.extractCodeContext(finding, finding.file);
      }
      
      if (fs.existsSync(srcEntryPath)) {
        finding.file = srcEntryPath;
        return this.extractCodeContext(finding, finding.file);
      }
    }
    
    return null;
  }

  /**
   * Check if rule needs full file context
   */
  needsFullFileContext(rule) {
    const rulesNeedingFullContext = [
      'MISSING_HELMET',
      'MISSING_RATE_LIMITING',
      'MISSING_AUTHENTICATION',
      'NESTJS_MISSING_HELMET',
      'NESTJS_MISSING_GUARDS',
      'FASTIFY_MISSING_HELMET',
      'FASTIFY_MISSING_RATE_LIMIT'
    ];
    
    return rulesNeedingFullContext.includes(rule);
  }

  /**
   * Generate complete remediation with patches
   */
  async generateRemediation(findings, projectPath, outputDir) {
    // Generate fixes
    const { fixes, errors } = await this.generateFixes(findings, projectPath);
    
    if (fixes.length === 0) {
      console.log(chalk.yellow('\n⚠️  No fixes generated\n'));
      return { fixes: [], savedFiles: [], errors };
    }
    
    // Save fixed files directly
    const replacer = new DirectFileReplacer(outputDir, { verbose: this.verbose });
    const { savedFiles, failedFiles } = await replacer.saveFixedFiles(fixes, projectPath);
    
    // Generate detailed report
    this.generateDetailedReport(fixes, savedFiles, outputDir);
    
    // Calculate statistics
    const stats = this.calculateStatistics(fixes, findings);
    
    return {
      fixes,
      savedFiles,
      errors: [...errors, ...failedFiles],
      stats
    };
  }

  /**
   * Generate detailed remediation report
   */
  generateDetailedReport(fixes, patches, outputDir) {
    const reportPath = path.join(outputDir, 'REMEDIATION_REPORT.md');
    
    let report = `# Security Remediation Report\n\n`;
    report += `Generated: ${new Date().toLocaleString()}\n\n`;
    
    report += `## Summary\n\n`;
    report += `- Total fixes generated: ${fixes.length}\n`;
    report += `- High confidence: ${fixes.filter(f => f.confidence === 'high').length}\n`;
    report += `- Medium confidence: ${fixes.filter(f => f.confidence === 'medium').length}\n`;
    report += `- Low confidence: ${fixes.filter(f => f.confidence === 'low').length}\n\n`;
    
    // Group by rule
    const byRule = this.groupByRule(fixes);
    
    report += `## Fixes by Type\n\n`;
    for (const [rule, ruleFixes] of Object.entries(byRule)) {
      report += `### ${rule} (${ruleFixes.length} fixes)\n\n`;
      
      ruleFixes.forEach((fix, i) => {
        report += `#### ${i + 1}. ${path.basename(fix.finding.file)}\n\n`;
        report += `**Severity:** ${fix.finding.severity}  \n`;
        report += `**Confidence:** ${fix.confidence}  \n`;
        report += `**Lines:** ${fix.startLine}-${fix.endLine}\n\n`;
        
        report += `**Before:**\n\`\`\`javascript\n${fix.before}\n\`\`\`\n\n`;
        report += `**After:**\n\`\`\`javascript\n${fix.after}\n\`\`\`\n\n`;
        report += `---\n\n`;
      });
    }
    
    fs.writeFileSync(reportPath, report);
    console.log(chalk.gray(`\n📄 Detailed report: ${reportPath}`));
  }

  /**
   * Group fixes by rule
   */
  groupByRule(fixes) {
    return fixes.reduce((acc, fix) => {
      const rule = fix.finding.rule;
      if (!acc[rule]) acc[rule] = [];
      acc[rule].push(fix);
      return acc;
    }, {});
  }

  /**
   * Calculate statistics
   */
  calculateStatistics(fixes, findings) {
    const totalTokens = fixes.reduce((sum, f) => sum + (f.tokensUsed || 0), 0);
    const avgTokens = fixes.length > 0 ? Math.round(totalTokens / fixes.length) : 0;
    
    return {
      totalFindings: findings.length,
      fixesGenerated: fixes.length,
      successRate: ((fixes.length / findings.length) * 100).toFixed(1) + '%',
      confidenceBreakdown: {
        high: fixes.filter(f => f.confidence === 'high').length,
        medium: fixes.filter(f => f.confidence === 'medium').length,
        low: fixes.filter(f => f.confidence === 'low').length
      },
      totalTokens,
      avgTokensPerFix: avgTokens,
      estimatedCost: (totalTokens / 1000000 * 0.59).toFixed(4) // Groq pricing
    };
  }

  /**
   * Delay helper for rate limiting
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
