# OpenRouter Setup Guide

OpenRouter gives you access to **FREE** Llama 3.3 70B with no rate limits!

## Quick Setup (2 minutes)

### 1. Get API Key

1. Go to https://openrouter.ai/
2. Click "Sign In" (top right)
3. Sign in with Google/GitHub
4. Go to https://openrouter.ai/keys
5. Click "Create Key"
6. Copy your key (starts with `sk-or-v1-...`)

### 2. Set Environment Variable

```bash
export OPENROUTER_API_KEY="sk-or-v1-YOUR_KEY_HERE"
```

Or add to `~/.bashrc` or `~/.zshrc`:

```bash
echo 'export OPENROUTER_API_KEY="sk-or-v1-YOUR_KEY_HERE"' >> ~/.bashrc
source ~/.bashrc
```

### 3. Run MicroSec-Scan

```bash
microsec-scan fix -p ~/dev/E-commerce -o ~/dev/E-commerce/fixes \
  --provider openrouter \
  -v
```

That's it! No rate limits, completely free!

## What Model is Used?

By default, it uses: **`meta-llama/llama-3.3-70b-instruct:free`**

This is:
- ✅ **FREE** (no cost)
- ✅ **Fast** (similar to Groq)
- ✅ **High quality** (70B parameter model)
- ✅ **No rate limits** (unlike Groq's 100K/day)

## Example Output

```bash
$ microsec-scan fix -p ~/dev/E-commerce -o ~/dev/E-commerce/fixes --provider openrouter -v

🤖 MicroSec-Scan Auto-Fix Mode

Step 1/3: Scanning for vulnerabilities...
   Found 63 issues

Step 2/3: Generating fixes with LLM...
Batching 63 issues across 19 files

[1/19] Processing index.js (4 issues)...
  🤖 Generating 4 fixes for index.js...
     📤 API Call → meta-llama/llama-3.3-70b-instruct:free
     📊 Est. input: ~603 tokens
  ✓ Generated 4 fixes
     ⏱️  Duration: 1.2s
     📊 Tokens: 589 in + 314 out = 903 total
     💰 Cost: $0.000000  ← FREE!

[2/19] Processing app.js (5 issues)...
  🤖 Generating 5 fixes for app.js...
     📤 API Call → meta-llama/llama-3.3-70b-instruct:free
     📊 Est. input: ~2,238 tokens
  ✓ Generated 5 fixes
     ⏱️  Duration: 2.5s
     📊 Tokens: 2216 in + 1752 out = 3968 total
     💰 Cost: $0.000000  ← FREE!

...continues for all files...

✅ Generated 63 fixes from 19 API calls
   Total cost: $0.00 (FREE!)
```

## Troubleshooting

### "API key required"

Make sure you set the environment variable:

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
```

Or pass it directly:

```bash
microsec-scan fix -p ~/dev/E-commerce \
  --provider openrouter \
  --api-key "sk-or-v1-..."
```

### "Model not found" or 401 error

- Make sure your API key is correct
- Verify you're signed up at https://openrouter.ai/

### Want to use a different model?

```bash
# Use faster 8B model (even faster, still free)
microsec-scan fix -p ~/dev/E-commerce \
  --provider openrouter \
  --model "meta-llama/llama-3.1-8b-instruct:free"

# Use paid model if you have credits
microsec-scan fix -p ~/dev/E-commerce \
  --provider openrouter \
  --model "anthropic/claude-3.5-sonnet"
```

See all available models: https://openrouter.ai/models

## Why OpenRouter?

| Feature | Groq | OpenRouter |
|---------|------|------------|
| Free Tier | 100K tokens/day | ✅ Unlimited |
| Rate Limits | ⚠️ Yes | ✅ No |
| Model | Llama 3.3 70B | Llama 3.3 70B |
| Speed | ⚡⚡⚡⚡⚡ | ⚡⚡⚡⚡ |
| Quality | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

**Bottom line:** OpenRouter is better for development because you won't hit rate limits!

## Complete Example

```bash
# 1. Set API key
export OPENROUTER_API_KEY="sk-or-v1-abc123..."

# 2. Generate fixes
microsec-scan fix -p ~/dev/E-commerce -o ~/dev/E-commerce/fixes --provider openrouter -v

# 3. Review fixes
cat ~/dev/E-commerce/fixes/FIXES_SUMMARY.md

# 4. Apply fixes
cd ~/dev/E-commerce/fixes
./apply-fixes.sh

# 5. Test
cd ~/dev/E-commerce
docker-compose up -d

# 6. Verify
microsec-scan scan -p ~/dev/E-commerce
```

---

**Get started now:** https://openrouter.ai/keys
