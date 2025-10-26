/**
 * Fix Applicator - Generates Git patch files from LLM-generated fixes
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import crypto from 'crypto';
import * as Diff from 'diff';

export class FixApplicator {
  constructor(outputDir, options = {}) {
    this.outputDir = outputDir;
    this.patchesDir = path.join(outputDir, 'patches');
    this.verbose = options.verbose || false;
    
    // Create directories
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    if (!fs.existsSync(this.patchesDir)) {
      fs.mkdirSync(this.patchesDir, { recursive: true });
    }
  }

  /**
   * Generate patch files from fixes (ONE PATCH PER FILE)
   */
  async generatePatches(fixes, projectPath) {
    const patches = [];
    const failedFixes = [];

    console.log(chalk.cyan(`\n📝 Generating patch files...\n`));

    // Group fixes by file
    const byFile = this.groupFixesByFile(fixes);
    const fileCount = Object.keys(byFile).length;
    
    let patchIndex = 1;
    
    for (const [filePath, fileFixes] of Object.entries(byFile)) {
      try {
        // Use the first fix (they all have the same "after" since it's batched)
        const primaryFix = fileFixes[0];
        
        // Collect all rules fixed in this file
        const rules = fileFixes.map(f => f.finding.rule);
        
        const patchFile = this.generatePatchFile(primaryFix, patchIndex, projectPath, rules);
        patches.push(patchFile);
        
        console.log(chalk.green(`  ✓ Generated patch ${patchIndex}/${fileCount}: ${patchFile.name} (${rules.length} issues)`));
        patchIndex++;
        
      } catch (error) {
        console.error(chalk.red(`  ✗ Failed to generate patch for ${filePath}: ${error.message}`));
        fileFixes.forEach(fix => {
          failedFixes.push({ fix, error: error.message });
        });
      }
    }

    // Generate apply and rollback scripts
    this.generateApplyScript(patches, projectPath);
    this.generateRollbackScript(projectPath);
    
    // Generate summary report
    this.generateSummaryReport(patches, failedFixes, fixes);

    console.log(chalk.green(`\n✅ Generated ${patches.length} patch files (${fixes.length} issues fixed)`));
    if (failedFixes.length > 0) {
      console.log(chalk.yellow(`⚠️  ${failedFixes.length} fixes failed`));
    }

    return { patches, failedFixes };
  }

  /**
   * Group fixes by file
   */
  groupFixesByFile(fixes) {
    const grouped = {};
    fixes.forEach(fix => {
      const file = fix.finding.file;
      if (!grouped[file]) {
        grouped[file] = [];
      }
      grouped[file].push(fix);
    });
    return grouped;
  }

  /**
   * Generate a single patch file
   */
  generatePatchFile(fix, index, projectPath, rules = []) {
    // Create filename based on the file being fixed, not the rule
    const relativeFilePath = path.relative(projectPath, fix.finding.file);
    const fileBasename = path.basename(relativeFilePath, path.extname(relativeFilePath));
    const fileName = `${String(index).padStart(3, '0')}-${this.slugify(fileBasename)}.patch`;
    const filePath = path.join(this.patchesDir, fileName);
    
    // Re-read the actual current file content to ensure exact match
    const actualFilePath = path.join(projectPath, relativeFilePath);
    let currentContent = fix.before;
    
    try {
      if (fs.existsSync(actualFilePath)) {
        currentContent = fs.readFileSync(actualFilePath, 'utf-8');
      }
    } catch (err) {
      // Use fix.before as fallback
    }
    
    const patchContent = this.createUnifiedDiff(
      { ...fix, before: currentContent }, 
      relativeFilePath, 
      rules
    );
    
    fs.writeFileSync(filePath, patchContent);
    
    return {
      name: fileName,
      path: filePath,
      rules: rules.length > 0 ? rules : [fix.finding.rule],
      file: relativeFilePath,
      confidence: fix.confidence
    };
  }

  /**
   * Create unified diff format (Git patch)
   */
  createUnifiedDiff(fix, relativeFilePath, rules = []) {
    // Use diff library to create proper unified diff
    const patch = Diff.createPatch(
      relativeFilePath,
      fix.before,
      fix.after,
      'original',
      'fixed',
      { context: 3 }
    );
    
    // Add metadata header
    let result = `From microsec-scan ${new Date().toISOString()}\n`;
    
    if (rules.length > 1) {
      result += `Subject: [SECURITY FIX] Multiple issues (${rules.length})\n\n`;
      result += `Fixed issues:\n`;
      rules.forEach(rule => {
        result += `  - ${rule}\n`;
      });
      result += `\n`;
    } else {
      result += `Subject: [SECURITY FIX] ${fix.finding.rule}\n\n`;
      result += `${fix.finding.message}\n`;
      result += `Severity: ${fix.finding.severity}\n`;
    }
    
    result += `Confidence: ${fix.confidence}\n`;
    result += `File: ${relativeFilePath}\n\n`;
    
    if (fix.explanation) {
      result += `Explanation:\n${this.formatExplanation(fix.explanation)}\n\n`;
    }
    
    result += `---\n`;
    result += patch;
    
    return result;
  }

  /**
   * Format explanation text
   */
  formatExplanation(explanation) {
    // Extract just the text part, remove code blocks
    const lines = explanation.split('\n');
    const textLines = [];
    let inCodeBlock = false;
    
    for (const line of lines) {
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      if (!inCodeBlock && line.trim()) {
        textLines.push(line);
      }
    }
    
    return textLines.join('\n').substring(0, 500); // Limit length
  }

  /**
   * Generate shell script to apply all patches
   */
  generateApplyScript(patches, projectPath) {
    const scriptPath = path.join(this.outputDir, 'apply-all.sh');
    
    const script = `#!/bin/bash
# Auto-generated script to apply security fixes
# Generated: ${new Date().toISOString()}
# Project: ${projectPath}

set -e

echo "🔧 Applying ${patches.length} security fixes..."
echo ""

# Check if in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "⚠️  Warning: Not in a Git repository. Continuing anyway..."
  echo ""
fi

# Create backup using git stash (if in git repo)
if git rev-parse --git-dir > /dev/null 2>&1; then
  echo "📦 Creating backup with git stash..."
  git stash push -m "Pre-security-fix backup $(date +%Y%m%d_%H%M%S)" || echo "No changes to stash"
  echo ""
fi

# Apply patches one by one
APPLIED=0
FAILED=0

${patches.map((p, i) => `
echo "[${i + 1}/${patches.length}] Applying ${p.name}..."
echo "  File: ${p.file}"
echo "  Issues: ${Array.isArray(p.rules) ? p.rules.length : 1}"
echo "  Confidence: ${p.confidence}"

if git apply --check "patches/${p.name}" 2>/dev/null; then
  git apply "patches/${p.name}"
  echo "  ✓ Applied successfully"
  ((APPLIED++))
else
  echo "  ✗ Failed to apply - may need manual review"
  ((FAILED++))
fi
echo ""
`).join('')}

echo "================================================="
echo "Summary:"
echo "  Applied: $APPLIED"
echo "  Failed: $FAILED"
echo "================================================="
echo ""

if [ $FAILED -eq 0 ]; then
  echo "✅ All fixes applied successfully!"
else
  echo "⚠️  Some fixes failed. Review the output above."
  echo "    Check patches/README.md for manual application instructions."
fi

echo ""
echo "Next steps:"
echo "  1. Review the changes: git diff"
echo "  2. Test your application"
echo "  3. Re-scan: microsec-scan scan -p ${projectPath}"
echo "  4. If issues, rollback: ./rollback.sh"
`;

    fs.writeFileSync(scriptPath, script);
    fs.chmodSync(scriptPath, 0o755); // Make executable
    
    if (this.verbose) {
      console.log(chalk.gray(`  Generated: apply-all.sh`));
    }
  }

  /**
   * Generate rollback script
   */
  generateRollbackScript(projectPath) {
    const scriptPath = path.join(this.outputDir, 'rollback.sh');
    
    const script = `#!/bin/bash
# Rollback script for security fixes
# Generated: ${new Date().toISOString()}

set -e

echo "🔄 Rolling back security fixes..."
echo ""

# Check if in git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "❌ Error: Not in a Git repository. Cannot rollback."
  exit 1
fi

# List recent stashes related to security fixes
echo "Recent backups (stashes):"
git stash list | grep "Pre-security-fix" | head -5
echo ""

# Get the most recent security fix stash
STASH=$(git stash list | grep "Pre-security-fix" | head -1 | cut -d: -f1)

if [ -z "$STASH" ]; then
  echo "❌ No security fix backup found"
  exit 1
fi

echo "Found backup: $STASH"
read -p "Restore this backup? This will discard current changes. (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "Restoring backup..."
  git reset --hard HEAD
  git stash pop "$STASH"
  echo "✅ Rollback complete"
else
  echo "Cancelled"
fi
`;

    fs.writeFileSync(scriptPath, script);
    fs.chmodSync(scriptPath, 0o755); // Make executable
    
    if (this.verbose) {
      console.log(chalk.gray(`  Generated: rollback.sh`));
    }
  }

  /**
   * Generate summary report
   */
  generateSummaryReport(patches, failedFixes, allFixes) {
    const reportPath = path.join(this.outputDir, 'FIXES_SUMMARY.md');
    
    let report = `# Security Fixes Summary\n\n`;
    report += `Generated: ${new Date().toLocaleString()}\n\n`;
    report += `## Overview\n\n`;
    report += `- **Total Fixes Generated:** ${allFixes.length}\n`;
    report += `- **Successful Patches:** ${patches.length}\n`;
    report += `- **Failed:** ${failedFixes.length}\n\n`;
    
    if (patches.length > 0) {
      report += `## Patches Generated\n\n`;
      report += `| # | File | Issues Fixed | Confidence |\n`;
      report += `|---|------|--------------|------------|\n`;
      
      patches.forEach((p, i) => {
        const emoji = p.confidence === 'high' ? '🟢' : p.confidence === 'medium' ? '🟡' : '🔴';
        const issueCount = Array.isArray(p.rules) ? p.rules.length : 1;
        const rulesList = Array.isArray(p.rules) ? p.rules.join(', ') : p.rule || 'Unknown';
        report += `| ${i + 1} | ${p.file} | ${issueCount} (${rulesList}) | ${emoji} ${p.confidence} |\n`;
      });
      report += `\n`;
    }
    
    if (failedFixes.length > 0) {
      report += `## Failed Fixes\n\n`;
      failedFixes.forEach((f, i) => {
        report += `${i + 1}. **${f.fix.finding.rule}** in ${f.fix.finding.file}\n`;
        report += `   - Error: ${f.error}\n\n`;
      });
    }
    
    report += `## How to Apply\n\n`;
    report += `### Option 1: Apply All Patches (Recommended)\n\n`;
    report += `\`\`\`bash\n`;
    report += `cd ${path.dirname(this.outputDir)}\n`;
    report += `./apply-all.sh\n`;
    report += `\`\`\`\n\n`;
    
    report += `### Option 2: Apply Individual Patches\n\n`;
    report += `\`\`\`bash\n`;
    report += `# Review the patch\n`;
    report += `cat patches/001-*.patch\n\n`;
    report += `# Apply it\n`;
    report += `git apply patches/001-*.patch\n`;
    report += `\`\`\`\n\n`;
    
    report += `### Option 3: Review Before Applying\n\n`;
    report += `\`\`\`bash\n`;
    report += `# Check if patch can be applied cleanly\n`;
    report += `git apply --check patches/001-*.patch\n\n`;
    report += `# See what changes will be made\n`;
    report += `git apply --stat patches/001-*.patch\n\n`;
    report += `# Apply the patch\n`;
    report += `git apply patches/001-*.patch\n`;
    report += `\`\`\`\n\n`;
    
    report += `## Rollback\n\n`;
    report += `If something goes wrong:\n\n`;
    report += `\`\`\`bash\n`;
    report += `./rollback.sh\n`;
    report += `\`\`\`\n\n`;
    
    report += `## Verification\n\n`;
    report += `After applying fixes, re-scan to verify:\n\n`;
    report += `\`\`\`bash\n`;
    report += `microsec-scan scan -p . -f json -o post-fix.json\n`;
    report += `microsec-scan compare -b baseline.json -c post-fix.json\n`;
    report += `\`\`\`\n`;
    
    fs.writeFileSync(reportPath, report);
    
    if (this.verbose) {
      console.log(chalk.gray(`  Generated: FIXES_SUMMARY.md`));
    }
  }

  /**
   * Create URL-safe slug from string
   */
  slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Calculate file hash for verification
   */
  calculateHash(content) {
    return crypto.createHash('md5').update(content).digest('hex');
  }
}
