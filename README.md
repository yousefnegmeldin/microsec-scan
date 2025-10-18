# MicroSec-Scan 🔒

A fast, AST-based security scanner for microservices architectures. Detects vulnerabilities in Express.js, NestJS, and Fastify applications.

## ✨ Features

- 🔍 **AST-Based Analysis** - Accurate code parsing, no regex patterns
- 🚀 **Framework Support** - Express, NestJS, Fastify
- 🛡️ **Security Checks** - 25+ security rules
- 📊 **Route Analysis** - Detect unprotected endpoints
- 🐳 **Docker Support** - Analyze docker-compose.yml
- 📍 **Precise Reporting** - Exact line numbers from AST

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

**With route analysis:**
```bash
microsec-scan -p /path/to/project --show-routes
```

**Verbose output:**
```bash
microsec-scan -p /path/to/project --verbose --show-routes
```

**JSON output:**
```bash
microsec-scan -p /path/to/project --format json --output report.json
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

## 🛠️ CLI Options

```
Options:
  -p, --path <path>        Path to scan (required)
  --show-routes            Display route analysis table
  --verbose                Show detailed output
  --format <type>          Output format: text or json (default: text)
  --output <file>          Save report to file
  -h, --help               Display help
```

## 🔧 Supported Frameworks

- **Express.js** - Full support with route detection
- **NestJS** - Decorator-based route analysis
- **Fastify** - Plugin and hook detection

## 📦 Requirements

- Node.js >= 18
- npm >= 8

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
