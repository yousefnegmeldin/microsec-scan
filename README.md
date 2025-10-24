# MicroSec-Scan 🔒

A fast, AST-based security scanner for microservices architectures with **LLM-assisted refactoring**. Detects vulnerabilities and automatically generates fixes for Express.js, NestJS, and Fastify applications.

## ✨ Features

### Core Scanning
- 🔍 **AST-Based Analysis** - Accurate code parsing, no regex patterns
- 🚀 **Framework Support** - Express, NestJS, Fastify
- 🛡️ **Security Checks** - 25+ security rules
- 📊 **Route Analysis** - Detect unprotected endpoints
- 📡 **Egress Analysis** - Track outbound connections (RabbitMQ, HTTP/HTTPS)
- 🐳 **Docker Support** - Analyze docker-compose.yml
- 📍 **Precise Reporting** - Exact line numbers from AST

### 🆕 LLM Prompt Generation
- 🤖 **Smart Prompts** - Generates LLM-ready prompts with full context
- 📄 **Minimal Output** - Just 1 JSON + 1 PDF (no file mess)
- 🎯 **Grouped by File** - All vulnerabilities organized per file
- 📋 **Complete Context** - Includes full code or relevant sections
- 🔍 **Rule-Aware** - Uses security rule metadata for better prompts
- 📊 **Clean PDF** - Simple, organized format for easy copying

## 🚀 Quick Start

### Installation

```bash
npm install -g microsec-scan
```

Or use locally:

```bash
git clone https://github.com/yousefnegmeldin/microservices-security-scanner.git
cd microservices-security-scanner
npm install
npm link
```

### Usage

**Basic scan:**
```bash
microsec-scan -p /path/to/project
```

**With route and egress analysis:**
```bash
microsec-scan -p /path/to/project --show-routes --show-egress
```

**JSON output (for baseline):**
```bash
microsec-scan -p /path/to/project --format json --output baseline.json
```

**🆕 Generate LLM prompts:**
```bash
# Generate prompts with full context
microsec-scan refactor -p /path/to/project

# Outputs: prompts.json + prompts.pdf
```

**🆕 Compare before/after:**
```bash
microsec-scan compare -b baseline.json -c current.json
```

## 📋 What It Detects

### Security Issues
- ❌ Missing helmet middleware
- ❌ Missing rate limiting
- ❌ Permissive CORS configuration
- ❌ Missing body size limits
- ❌ Hardcoded secrets
- ❌ Insecure HTTP connections
- ❌ Plaintext AMQP/RabbitMQ
- ❌ Unprotected sensitive routes
- ❌ Exposed debug/admin endpoints

### Docker Issues
- ❌ Default credentials
- ❌ Root containers
- ❌ Missing health checks
- ❌ Plaintext connections

### Egress/Output Tracking
- 📡 RabbitMQ operations (publish, consume, sendToQueue)
- 📡 HTTP/HTTPS calls to external APIs
- 📡 Internal service-to-service communication
- 🔒 Insecure outbound connections

## 📊 Example Output

```
🚀 Scanning /home/user/project ...

📍 Route Analysis: /home/user/project/services/auth
   Total routes: 10 | Authenticated: 5 | Public: 5

   Route                          Authenticated     Type
   ─────────────────────────────────────────────────────
   GET    /admin/users            Yes               JWT
   POST   /auth/login             Public            N/A
   GET    /health                 Public            N/A

=== Security Scan Report ===

📄 /home/user/project/services/auth
  ├─ [MISSING_HELMET] App missing helmet middleware (HIGH)
  ├─ [MISSING_RATE_LIMITING] App missing rate limiting (HIGH)

📄 /home/user/project/services/auth/src/app.js
  ├─ [PERMISSIVE_CORS] CORS allows all domains (line 12) (MEDIUM)

✅ Total issues: 3
```

## 📚 Documentation

- [System Architecture](./docs/SYSTEM_ARCHITECTURE.md) - Complete system overview
- [AST Parsing Guide](./docs/AST_PARSING_GUIDE.md) - Learn about AST concepts
- [Egress Analysis](./docs/EGRESS_ANALYSIS.md) - Track outbound connections

## 🛠️ CLI Commands

### `microsec-scan` - Main Scan
```bash
microsec-scan [options]

Options:
  -p, --path <dir>         Project directory to scan (default: ".")
  -f, --format <type>      Output format: json|console (default: "console")
  -o, --output <file>      Save report to file
  -v, --verbose            Enable detailed logs
  -r, --show-routes        Display route analysis table
  -e, --show-egress        Display egress connections
```

### `microsec-scan refactor` - Generate LLM Prompts
```bash
microsec-scan refactor [options]

Options:
  -p, --path <dir>         Project directory to scan (default: ".")
  -o, --output <dir>       Output directory (default: "./refactor_output")
  -v, --verbose            Enable detailed logs

Output:
  prompts.json            JSON file with all prompts
  prompts.pdf             PDF with formatted prompts for LLM
```

### `microsec-scan compare` - Metrics Comparison
```bash
microsec-scan compare [options]

Options:
  -b, --baseline <file>    Baseline scan results (required)
  -c, --current <file>     Current scan results (required)
  -o, --output <dir>       Output directory (default: "./metrics")
```

## 🔧 Supported Frameworks

- **Express.js** - Full support with route detection
- **NestJS** - Decorator-based route analysis
- **Fastify** - Plugin and hook detection

## 📦 Requirements

- Node.js >= 18
- npm >= 8

For LLM prompts: Any LLM (ChatGPT, Claude, Gemini, etc.)

## 🤝 Contributing

Contributions welcome! Please open an issue or submit a PR.

## 📄 License

MIT

## 🙏 Acknowledgments

Built with:
- [@babel/parser](https://babeljs.io/docs/babel-parser) - AST parsing
- [@babel/traverse](https://babeljs.io/docs/babel-traverse) - AST traversal
- [js-yaml](https://github.com/nodeca/js-yaml) - YAML parsing
- [chalk](https://github.com/chalk/chalk) - Terminal colors

---

**Made with ❤️ for secure microservices**
