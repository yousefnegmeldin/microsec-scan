# Quick Start: Auto-Fix Your E-commerce Project

## 1. Install & Setup (One-time)

```bash
# Navigate to scanner
cd /home/yousef/dev/bachelor/microsec-scan

# Install dependencies
npm install

# Get Groq API key from https://console.groq.com/
# Then set it:
export GROQ_API_KEY="gsk_your_key_here"
```

## 2. Generate Fixes

```bash
microsec-scan fix -p ~/dev/E-commerce -o ~/dev/E-commerce/fixes
```

This scans your E-commerce project and generates patch files with LLM-generated fixes.

## 3. Review Fixes

```bash
# Quick summary
cat ~/dev/E-commerce/fixes/FIXES_SUMMARY.md

# Detailed before/after code
cat ~/dev/E-commerce/fixes/REMEDIATION_REPORT.md

# Individual patches
ls ~/dev/E-commerce/fixes/patches/
```

## 4. Apply Fixes

```bash
cd ~/dev/E-commerce
./fixes/apply-all.sh
```

## 5. Verify

```bash
# Review changes
git diff

# Test your app
docker-compose up -d
# Test endpoints...

# Re-scan to verify fixes
microsec-scan scan -p ~/dev/E-commerce
```

## 6. Rollback (if needed)

```bash
cd ~/dev/E-commerce
./fixes/rollback.sh
```

---

## Understanding the Output

After step 2, you'll see:

```
🤖 MicroSec-Scan Auto-Fix Mode

Step 1/3: Scanning for vulnerabilities...
   Found 15 issues

Step 2/3: Generating fixes with LLM...
[1/15] Processing MISSING_HELMET in app.js...
  🤖 Generating fix for MISSING_HELMET...
  ✓ Fix generated
...

✅ Generated 12 fixes

Statistics:
  Total issues: 15
  Fixes generated: 12
  Success rate: 80.0%
  Confidence: High=8 Medium=4 Low=0
  Tokens used: 45,234
  Estimated cost: $0.0267

📦 Output Files:
  ~/dev/E-commerce/fixes/
  ├── patches/              # Git patch files
  ├── apply-all.sh          # Apply all fixes
  ├── rollback.sh           # Rollback changes
  ├── FIXES_SUMMARY.md      # Quick reference
  ├── REMEDIATION_REPORT.md # Detailed report
  └── baseline.json         # Original findings

Next steps:
  1. Review fixes: cat ~/dev/E-commerce/fixes/FIXES_SUMMARY.md
  2. Apply fixes:  cd ~/dev/E-commerce && ./fixes/apply-all.sh
  3. Test your app
  4. Re-scan:      microsec-scan scan -p ~/dev/E-commerce
  5. If needed:    ~/dev/E-commerce/fixes/rollback.sh
```

## Patch File Structure

Each patch looks like this:

```
fixes/
└── patches/
    ├── 001-missing-helmet.patch          # Adds helmet middleware
    ├── 002-plaintext-broker.patch        # Fixes RabbitMQ TLS
    ├── 003-hardcoded-secret.patch        # Moves secrets to env vars
    └── ...
```

## How to Apply Individual Patches

```bash
# Check if patch can be applied
git apply --check ~/dev/E-commerce/fixes/patches/001-missing-helmet.patch

# Apply it
git apply ~/dev/E-commerce/fixes/patches/001-missing-helmet.patch

# See what it does
git diff
```

## Common Issues

### "API key required"
```bash
export GROQ_API_KEY="your-key-here"
```

### "Patch does not apply"
Files changed since scan. Re-run:
```bash
microsec-scan fix -p ~/dev/E-commerce -o ~/dev/E-commerce/fixes-new
```

### Want more details?
```bash
microsec-scan fix -p ~/dev/E-commerce -v  # verbose mode
```

---

## Full Workflow Example

```bash
# 1. Install (one-time)
cd ~/dev/bachelor/microsec-scan
npm install
export GROQ_API_KEY="gsk_..."

# 2. Generate fixes
microsec-scan fix -p ~/dev/E-commerce -o ~/dev/E-commerce/fixes

# 3. Review
cat ~/dev/E-commerce/fixes/FIXES_SUMMARY.md

# 4. Apply
cd ~/dev/E-commerce
./fixes/apply-all.sh

# 5. Check results
git diff
docker-compose up -d
# Test...

# 6. If good, commit
git add .
git commit -m "Apply security fixes from MicroSec-Scan"

# 7. If not good, rollback
./fixes/rollback.sh
```

## For Your Bachelor Thesis

Generate before/after comparison:

```bash
# Baseline
microsec-scan scan -p ~/dev/E-commerce -f json -o baseline.json

# Generate & apply fixes
microsec-scan fix -p ~/dev/E-commerce -o ~/dev/E-commerce/fixes
cd ~/dev/E-commerce && ./fixes/apply-all.sh

# Post-fix scan
microsec-scan scan -p ~/dev/E-commerce -f json -o post-fix.json

# Comparison for thesis
microsec-scan compare -b baseline.json -c post-fix.json -o comparison

# Results in comparison/ folder with metrics and improvement percentage
```

That's it! 🎉

For detailed documentation, see: `docs/AUTO_FIX_GUIDE.md`
