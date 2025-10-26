# Auto-Fix Guide: LLM-Based Security Remediation

This guide explains how to use MicroSec-Scan's automated fix generation using Groq's LLM API.

## Overview

The `fix` command:
1. Scans your project for security vulnerabilities
2. Uses Groq's LLM (Llama 3.1 70B) to generate code fixes
3. Creates Git patch files for each fix
4. Generates scripts for applying and rolling back changes

## Prerequisites

### 1. Install Dependencies

```bash
cd /home/yousef/dev/bachelor/microsec-scan
npm install
```

### 2. Get Groq API Key

1. Visit https://console.groq.com/
2. Sign up or log in
3. Create an API key
4. Set it as environment variable:

```bash
export GROQ_API_KEY="gsk_your_api_key_here"
```

Or add to `~/.bashrc` or `~/.zshrc`:

```bash
echo 'export GROQ_API_KEY="gsk_your_api_key_here"' >> ~/.bashrc
source ~/.bashrc
```

## Basic Usage

### Generate Fixes

```bash
microsec-scan fix -p ~/dev/E-commerce -o ./e-commerce-fixes
```

This will:
- Scan the E-commerce project
- Generate fixes using Groq LLM
- Create patch files in `./e-commerce-fixes/patches/`
- Generate `apply-all.sh` and `rollback.sh` scripts

### Command Options

```bash
microsec-scan fix \
  -p <project-path>              # Required: Path to scan
  -o <output-dir>                # Output directory (default: ./fixes)
  --api-key <key>                # Groq API key (or use GROQ_API_KEY env var)
  --model <model-name>           # LLM model (default: llama-3.1-70b-versatile)
  -v, --verbose                  # Show detailed logs
  --rate-limit-ms <ms>           # Delay between API calls (default: 1000)
```

## Output Structure

After running the fix command, you'll get:

```
e-commerce-fixes/
├── patches/
│   ├── 001-missing-helmet.patch
│   ├── 002-plaintext-broker.patch
│   ├── 003-hardcoded-secret.patch
│   └── ...
├── apply-all.sh                  # Script to apply all fixes
├── rollback.sh                   # Script to rollback changes
├── FIXES_SUMMARY.md              # Quick reference guide
├── REMEDIATION_REPORT.md         # Detailed before/after report
└── baseline.json                 # Original scan results
```

## Applying Fixes

### Option 1: Apply All Fixes (Recommended)

```bash
cd ~/dev/E-commerce
../bachelor/microsec-scan/e-commerce-fixes/apply-all.sh
```

The script will:
1. Create a git stash backup (if in git repo)
2. Apply each patch one by one
3. Report success/failure for each
4. Show summary at the end

### Option 2: Review Individual Patches

```bash
# View a specific patch
cat e-commerce-fixes/patches/001-missing-helmet.patch

# Check if patch can be applied cleanly
git apply --check e-commerce-fixes/patches/001-missing-helmet.patch

# See statistics about what will change
git apply --stat e-commerce-fixes/patches/001-missing-helmet.patch

# Apply the patch
git apply e-commerce-fixes/patches/001-missing-helmet.patch
```

### Option 3: Preview Changes

```bash
# Show what will change without applying
git apply --stat e-commerce-fixes/patches/*.patch

# Apply in dry-run mode
git apply --check e-commerce-fixes/patches/*.patch
```

## Understanding Patch Files

A patch file looks like this:

```diff
From microsec-scan 2025-10-26T14:30:00.000Z
Subject: [SECURITY FIX] MISSING_HELMET

App missing helmet middleware for security headers
Severity: high
Confidence: high
File: services/Payment/src/app.js
Lines: 10-15

Explanation:
Added helmet middleware to protect against common web vulnerabilities

---
--- a/services/Payment/src/app.js
+++ b/services/Payment/src/app.js
@@ -10,5 +10,7 @@
-const app = express();
+const app = express();
+const helmet = require('helmet');
+app.use(helmet());
```

**Key parts:**
- **Subject**: The security issue being fixed
- **Severity & Confidence**: How critical and how confident the fix is
- **File & Lines**: Where the change is made
- **Diff**: The actual code changes (`-` removed, `+` added)

## Rollback Changes

### If Something Goes Wrong

```bash
cd ~/dev/E-commerce
../bachelor/microsec-scan/e-commerce-fixes/rollback.sh
```

This will:
1. List recent git stashes created by the fix process
2. Ask for confirmation
3. Restore the backup and discard applied changes

### Manual Rollback

If you're not in a git repository:

```bash
# Revert specific changes
git apply -R e-commerce-fixes/patches/001-missing-helmet.patch

# Or restore from manual backup
cp -r ~/dev/E-commerce.backup/* ~/dev/E-commerce/
```

## Verification Workflow

### Complete Fix & Verify Workflow

```bash
# 1. Scan and generate fixes
microsec-scan fix -p ~/dev/E-commerce -o ./e-commerce-fixes

# 2. Review the summary
cat e-commerce-fixes/FIXES_SUMMARY.md

# 3. Review detailed report with code changes
cat e-commerce-fixes/REMEDIATION_REPORT.md

# 4. Apply fixes
cd ~/dev/E-commerce
../bachelor/microsec-scan/e-commerce-fixes/apply-all.sh

# 5. Review changes
git diff

# 6. Test your application
docker-compose up  # or your test command

# 7. Re-scan to verify fixes worked
cd ../bachelor/microsec-scan
microsec-scan scan -p ~/dev/E-commerce -f json -o post-fix.json

# 8. Compare before/after
microsec-scan compare -b e-commerce-fixes/baseline.json -c post-fix.json -o ./comparison

# 9. If satisfied, commit
cd ~/dev/E-commerce
git add .
git commit -m "Security fixes from MicroSec-Scan"

# 10. If not satisfied, rollback
../bachelor/microsec-scan/e-commerce-fixes/rollback.sh
```

## Confidence Levels

Each fix has a confidence level:

- **🟢 High**: Fix is straightforward (e.g., adding helmet middleware)
  - Safe to apply automatically
  - Well-tested pattern
  
- **🟡 Medium**: Fix needs minor review (e.g., CORS configuration)
  - Review before applying
  - May need customization
  
- **🔴 Low**: Fix needs careful review (e.g., complex refactoring)
  - Manual review required
  - May need adjustments

## Troubleshooting

### Patch Fails to Apply

**Error:** `patch does not apply`

**Solution:**
```bash
# Check if file has changed since scan
git status

# If file was modified, re-run the scan
microsec-scan fix -p ~/dev/E-commerce -o ./e-commerce-fixes-new

# Or manually apply the fix by copying the code
cat e-commerce-fixes/patches/001-missing-helmet.patch
# Copy the "+" lines manually to your file
```

### API Key Error

**Error:** `Groq API key required`

**Solution:**
```bash
# Set environment variable
export GROQ_API_KEY="gsk_your_key_here"

# Or pass directly
microsec-scan fix -p ~/dev/E-commerce --api-key "gsk_your_key_here"
```

### Rate Limit Error

**Error:** `Rate limit exceeded`

**Solution:**
```bash
# Increase delay between API calls
microsec-scan fix -p ~/dev/E-commerce --rate-limit-ms 2000
```

### Low Quality Fixes

If fixes seem incorrect:

1. Check the confidence level (aim for high/medium)
2. Review `REMEDIATION_REPORT.md` for before/after code
3. Try a different model:
   ```bash
   microsec-scan fix -p ~/dev/E-commerce --model llama-3.1-8b-instant
   ```
4. Report issues to improve prompts

## Cost Estimation

Groq pricing (as of October 2024):
- **Llama 3.1 70B**: ~$0.59 per 1M tokens

**Typical costs:**
- Small project (10 files, 5 issues): ~$0.01
- Medium project (50 files, 25 issues): ~$0.05
- Large project (200 files, 100 issues): ~$0.20

The tool shows estimated cost after completion.

## Best Practices

### 1. Always Create a Backup

```bash
# Before applying fixes
cp -r ~/dev/E-commerce ~/dev/E-commerce.backup
```

### 2. Review Before Applying

```bash
# Read the summary
cat e-commerce-fixes/FIXES_SUMMARY.md

# Check high-impact changes
grep -r "MISSING_HELMET" e-commerce-fixes/patches/
```

### 3. Apply in Stages

```bash
# Apply high-confidence fixes first
for patch in e-commerce-fixes/patches/*; do
  if grep -q "Confidence: high" "$patch"; then
    git apply "$patch"
  fi
done
```

### 4. Test Incrementally

```bash
# Apply one patch
git apply e-commerce-fixes/patches/001-missing-helmet.patch

# Test
npm test

# If good, commit
git commit -am "Add helmet middleware"

# Continue with next patch
```

## Examples

### Example 1: Fix E-commerce Services

```bash
# Generate fixes
export GROQ_API_KEY="gsk_..."
microsec-scan fix -p ~/dev/E-commerce -o ./ecom-fixes -v

# Review
cat ecom-fixes/FIXES_SUMMARY.md

# Apply
cd ~/dev/E-commerce
../bachelor/microsec-scan/ecom-fixes/apply-all.sh

# Verify
docker-compose up -d
# Test your endpoints
microsec-scan scan -p .
```

### Example 2: Fix Specific Service

```bash
# Scan and fix only Payment service
microsec-scan fix -p ~/dev/E-commerce/services/Payment -o ./payment-fixes

cd ~/dev/E-commerce/services/Payment
../../bachelor/microsec-scan/payment-fixes/apply-all.sh
```

### Example 3: Generate Fixes for Thesis

```bash
# Generate baseline
microsec-scan scan -p ~/dev/E-commerce -f json -o baseline.json

# Generate fixes
microsec-scan fix -p ~/dev/E-commerce -o ./thesis-fixes

# Apply fixes
cd ~/dev/E-commerce
../bachelor/microsec-scan/thesis-fixes/apply-all.sh

# Generate post-fix scan
microsec-scan scan -p . -f json -o post-fix.json

# Compare for thesis results
microsec-scan compare -b ../bachelor/microsec-scan/baseline.json \
                      -c post-fix.json \
                      -o ../bachelor/microsec-scan/thesis-results

# Now you have before/after data for your thesis!
```

## Next Steps

After successfully applying fixes:

1. **Test thoroughly** - Run your test suite
2. **Update dependencies** - Install any new packages mentioned in fixes
3. **Configure environment** - Update `.env` files with secure values
4. **Document changes** - Note what was fixed for your team
5. **Monitor** - Check logs after deployment

## Support

For issues or questions:
- Check `REMEDIATION_REPORT.md` for detailed explanations
- Review patch files for specific changes
- Re-run with `-v` flag for detailed logs
- File an issue with error messages and logs
