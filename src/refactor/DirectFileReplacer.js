/**
 * Direct File Replacer - Replaces files directly instead of using patches
 * Since we're doing full-file fixes, direct replacement is simpler and more reliable
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

export class DirectFileReplacer {
  constructor(outputDir, options = {}) {
    this.outputDir = outputDir;
    this.fixedFilesDir = path.join(outputDir, 'fixed_files');
    this.verbose = options.verbose || false;
    
    // Create directories
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    if (!fs.existsSync(this.fixedFilesDir)) {
      fs.mkdirSync(this.fixedFilesDir, { recursive: true });
    }
  }

  /**
   * Save fixed files
   */
  async saveFixedFiles(fixes, projectPath) {
    const savedFiles = [];
    const failedFiles = [];

    console.log(chalk.cyan(`\n📝 Saving fixed files...\n`));

    // Group fixes by file (they're already grouped but get unique files)
    const byFile = this.groupFixesByFile(fixes);
    const fileCount = Object.keys(byFile).length;
    
    let fileIndex = 1;
    
    for (const [filePath, fileFixes] of Object.entries(byFile)) {
      try {
        // Skip directory-level findings (can't fix these via file replacement)
        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
          console.log(chalk.yellow(`  ⚠️  Skipped ${path.relative(projectPath, filePath)}: directory-level issue`));
          continue;
        }
        
        // Use the first fix (they all have the same "after" content)
        const fix = fileFixes[0];
        
        // Create relative path
        const relativeFilePath = path.relative(projectPath, filePath);
        const fixedFilePath = path.join(this.fixedFilesDir, relativeFilePath);
        
        // Ensure directory exists
        const fixedFileDir = path.dirname(fixedFilePath);
        if (!fs.existsSync(fixedFileDir)) {
          fs.mkdirSync(fixedFileDir, { recursive: true });
        }
        
        // Save the fixed file
        fs.writeFileSync(fixedFilePath, fix.after);
        
        // Collect all rules fixed
        const rules = fileFixes.map(f => f.finding.rule);
        
        savedFiles.push({
          original: relativeFilePath,
          fixed: fixedFilePath,
          rules,
          confidence: fix.confidence
        });
        
        console.log(chalk.green(`  ✓ Saved ${fileIndex}/${fileCount}: ${relativeFilePath} (${rules.length} issues)`));
        fileIndex++;
        
      } catch (error) {
        console.error(chalk.red(`  ✗ Failed to save ${filePath}: ${error.message}`));
        failedFiles.push({ file: filePath, error: error.message });
      }
    }

    // Generate apply script
    this.generateApplyScript(savedFiles, projectPath);
    this.generateRollbackScript(projectPath);
    this.generateSummary(savedFiles, failedFiles, fixes);

    console.log(chalk.green(`\n✅ Saved ${savedFiles.length} fixed files (${fixes.length} issues fixed)`));
    if (failedFiles.length > 0) {
      console.log(chalk.yellow(`⚠️  ${failedFiles.length} files failed`));
    }

    return { savedFiles, failedFiles };
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
   * Generate apply script
   */
  generateApplyScript(savedFiles, projectPath) {
    const scriptPath = path.join(this.outputDir, 'apply-fixes.sh');
    
    const script = `#!/bin/bash
# Auto-generated script to apply security fixes by replacing files
# Generated: ${new Date().toISOString()}
# Project: ${projectPath}

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "\${BASH_SOURCE[0]}" )" && pwd )"
# Get the project directory (parent of fixes/)
PROJECT_DIR="${projectPath}"

echo "🔧 Applying ${savedFiles.length} security fixes..."
echo ""
echo "Script location: $SCRIPT_DIR"
echo "Project location: $PROJECT_DIR"
echo ""

# Change to project directory
cd "$PROJECT_DIR"

# Check if in a git repository
if git rev-parse --git-dir > /dev/null 2>&1; then
  echo "📦 Creating backup with git stash..."
  git stash push -m "Pre-security-fix backup $(date +%Y%m%d_%H%M%S)" || echo "No changes to stash"
  echo ""
else
  echo "⚠️  Not in a Git repository - creating manual backup..."
  BACKUP_DIR="$SCRIPT_DIR/backup_$(date +%Y%m%d_%H%M%S)"
  mkdir -p "$BACKUP_DIR"
  ${savedFiles.map(f => `  cp -p "${f.original}" "$BACKUP_DIR/${path.basename(f.original)}.backup" 2>/dev/null || true`).join('\n')}
  echo "   Backup saved to: $BACKUP_DIR"
  echo ""
fi

# Apply fixes by copying fixed files
APPLIED=0
FAILED=0

${savedFiles.map((f, i) => `
echo "[${i + 1}/${savedFiles.length}] Applying fixes to ${f.original}..."
echo "  Issues: ${f.rules.length} (${f.rules.join(', ')})"
echo "  Confidence: ${f.confidence}"

if cp "$SCRIPT_DIR/fixed_files/${f.original}" "${f.original}"; then
  echo "  ✓ Applied successfully"
  ((APPLIED++))
else
  echo "  ✗ Failed to apply"
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
fi

echo ""
echo "Next steps:"
echo "  1. Review the changes: git diff"
echo "  2. Test your application"
echo "  3. Re-scan: microsec-scan scan -p ${projectPath}"
echo "  4. If issues, rollback: ./rollback.sh"
`;

    fs.writeFileSync(scriptPath, script);
    fs.chmodSync(scriptPath, 0o755);
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
if git rev-parse --git-dir > /dev/null 2>&1; then
  echo "Recent backups (stashes):"
  git stash list | grep "Pre-security-fix" | head -5
  echo ""

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
else
  echo "⚠️  Not in a Git repository"
  echo "Look for backup_* directories and manually restore files"
fi
`;

    fs.writeFileSync(scriptPath, script);
    fs.chmodSync(scriptPath, 0o755);
  }

  /**
   * Generate summary
   */
  generateSummary(savedFiles, failedFiles, allFixes) {
    const summaryPath = path.join(this.outputDir, 'FIXES_SUMMARY.md');
    
    let summary = `# Security Fixes Summary\n\n`;
    summary += `Generated: ${new Date().toLocaleString()}\n\n`;
    summary += `## Overview\n\n`;
    summary += `- **Total Issues Fixed:** ${allFixes.length}\n`;
    summary += `- **Files Modified:** ${savedFiles.length}\n`;
    summary += `- **Failed:** ${failedFiles.length}\n\n`;
    
    if (savedFiles.length > 0) {
      summary += `## Files Modified\n\n`;
      summary += `| # | File | Issues Fixed | Confidence |\n`;
      summary += `|---|------|--------------|------------|\n`;
      
      savedFiles.forEach((f, i) => {
        const emoji = f.confidence === 'high' ? '🟢' : f.confidence === 'medium' ? '🟡' : '🔴';
        summary += `| ${i + 1} | ${f.original} | ${f.rules.length} | ${emoji} ${f.confidence} |\n`;
      });
      summary += `\n`;
    }
    
    summary += `## How to Apply\n\n`;
    summary += `\`\`\`bash\n`;
    summary += `cd ${path.dirname(this.outputDir)}\n`;
    summary += `./apply-fixes.sh\n`;
    summary += `\`\`\`\n\n`;
    
    summary += `## Rollback\n\n`;
    summary += `\`\`\`bash\n`;
    summary += `./rollback.sh\n`;
    summary += `\`\`\`\n`;
    
    fs.writeFileSync(summaryPath, summary);
  }
}
