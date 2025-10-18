# MicroSec-Scan: System Architecture & Documentation

## 📚 Table of Contents
1. [Overview](#overview)
2. [Folder Structure](#folder-structure)
3. [System Flow](#system-flow)
4. [AST-Based Analysis](#ast-based-analysis)
5. [File Descriptions](#file-descriptions)
6. [Example Output](#example-output)

---

## 🎯 Overview

**MicroSec-Scan** is an AST-based security scanner for microservices architectures. It analyzes Express.js, NestJS, and Fastify applications to detect security vulnerabilities and misconfigurations.

### Key Features:
- ✅ **100% AST-Based** - No regex pattern matching for code analysis
- ✅ **Framework-Agnostic** - Works with any variable naming conventions
- ✅ **Route-Level Analysis** - Detects unprotected sensitive endpoints
- ✅ **Dynamic Variable Tracking** - Understands code structure, not just patterns
- ✅ **Precise Line Numbers** - Accurate location reporting from AST
- ✅ **Docker Compose Support** - Analyzes container configurations

---

## 📁 Folder Structure

```
microsec-scan/
├── bin/
│   └── microsec-scan.js          # CLI entry point
├── src/
│   ├── parsers/
│   │   ├── ASTCodeParser.js      # AST-based code analyzer (AMQP, HTTP, secrets)
│   │   ├── composeParser.js      # Docker Compose YAML parser
│   │   ├── microserviceParser.js # Microservice orchestrator
│   │   └── frameworks/
│   │       ├── ASTExpressRouteParser.js    # AST Express route parser
│   │       ├── ASTFastifyRouteParser.js    # AST Fastify route parser
│   │       ├── ASTNestJSRouteParser.js     # AST NestJS route parser
│   │       ├── ASTFrameworkChecker.js      # AST framework config checker
│   │       ├── BaseFramework.js            # Base framework analyzer
│   │       ├── ExpressFramework.js         # Express analyzer
│   │       ├── FastifyFramework.js         # Fastify analyzer
│   │       ├── NestJSFramework.js          # NestJS analyzer
│   │       └── RouteAnalyzer.js            # Route data structures
│   ├── reporters/
│   │   ├── jsonReporter.js       # JSON output formatter
│   │   └── routeReporter.js      # Route table formatter
│   ├── rules/
│   │   └── registry.js           # Security rules registry
│   └── scanner.js                # Main scanner orchestrator
├── docs/
│   ├── AST_PARSING_GUIDE.md      # AST concepts and examples
│   └── SYSTEM_ARCHITECTURE.md    # This file
├── package.json
└── README.md
```

---

## 🔄 System Flow

### 1. **Entry Point** (`bin/microsec-scan.js`)
```
User runs: microsec-scan -p ~/project --show-routes
         ↓
    Parse CLI args
         ↓
    Call scanner.js
```

### 2. **Scanner Orchestration** (`src/scanner.js`)
```
runScanner()
    ↓
    ├─→ Scan Docker Compose (composeParser.js)
    │   └─→ Check for default credentials, root containers, plaintext connections
    │
    ├─→ Scan Microservices (microserviceParser.js)
    │   └─→ Detect framework (Express/NestJS/Fastify)
    │       └─→ Run framework-specific analysis
    │
    ├─→ Scan Source Code (ASTCodeParser.js)
    │   └─→ AST analysis for AMQP, HTTP, secrets
    │
    └─→ Generate Report (jsonReporter.js / routeReporter.js)
```

### 3. **Framework Analysis Flow**
```
ExpressFramework.analyze()
    ↓
    ├─→ Parse Routes (ASTExpressRouteParser.js)
    │   ├─→ Track variables: const app = express()
    │   ├─→ Find routes: app.get('/path', middleware, handler)
    │   └─→ Extract middleware chains
    │
    ├─→ Check Configurations (ASTFrameworkChecker.js)
    │   ├─→ checkHelmetAST()
    │   ├─→ checkCORSAST()
    │   ├─→ checkRateLimitingAST()
    │   └─→ checkBodySizeLimitAST()
    │
    └─→ Analyze Route Security
        ├─→ Identify authenticated routes
        ├─→ Flag unprotected sensitive routes
        └─→ Generate findings
```

---

## 🔬 AST-Based Analysis

### Why AST?

**Before (Regex):**
```javascript
// ❌ Hardcoded variable names
/app\.get\(['"`]([^'"`]+)['"`]/
// Breaks with: myServer.get('/path')
```

**After (AST):**
```javascript
// ✅ Dynamic variable tracking
traverse(ast, {
  VariableDeclarator(path) {
    if (isExpressApp(path.node.init)) {
      trackVariable(path.node.id.name); // Works with ANY name!
    }
  }
});
```

### AST Analysis Components:

#### 1. **Route Parsing** (ASTExpressRouteParser.js)
```javascript
// Step 1: Track Express instances
const app = express();        // ← Tracked
const myServer = express();   // ← Tracked
const r = Router();           // ← Tracked

// Step 2: Find routes using tracked variables
app.get('/users', handler);        // ← Detected
myServer.post('/api', handler);    // ← Detected
r.get('/health', handler);         // ← Detected
```

#### 2. **Code Analysis** (ASTCodeParser.js)
```javascript
traverse(ast, {
  StringLiteral(path) {
    // Detects: const url = "http://example.com"
    if (/^http:\/\//.test(path.node.value)) {
      findings.push({
        rule: "INSECURE_HTTP",
        line: path.node.loc.start.line  // ← Precise!
      });
    }
  }
});
```

#### 3. **Framework Config** (ASTFrameworkChecker.js)
```javascript
traverse(ast, {
  CallExpression(path) {
    // Detects: app.use(cors({ origin: '*' }))
    if (callee.name === 'cors') {
      checkOriginProperty(path.node.arguments);
    }
  }
});
```

---

## 📝 File Descriptions

### Core Files

#### **`src/scanner.js`**
- **Purpose**: Main orchestrator
- **Responsibilities**:
  - Coordinate all parsers
  - Collect findings from all sources
  - Generate final report
- **Key Functions**:
  - `runScanner()` - Entry point
  - Calls: `analyzeCompose()`, `analyzeMicroservice()`, `analyzeSource()`

#### **`src/parsers/ASTCodeParser.js`**
- **Purpose**: AST-based source code analyzer
- **Detects**:
  - Plaintext AMQP connections (`amqp://`)
  - Insecure HTTP connections (`http://`)
  - Hardcoded secrets (passwords, API keys)
- **Key Functions**:
  - `analyzeSource()` - Main entry
  - `checkPlaintextAMQP()` - AST traversal for AMQP
  - `checkInsecureHTTP()` - AST traversal for HTTP
  - `checkHardcodedSecrets()` - AST traversal for secrets

#### **`src/parsers/composeParser.js`**
- **Purpose**: Docker Compose YAML analyzer
- **Detects**:
  - Default credentials (guest:guest)
  - Root containers
  - Plaintext broker connections
  - Missing health checks
- **Key Functions**:
  - `analyzeCompose()` - Parse docker-compose.yml
  - Uses `js-yaml` for parsing

#### **`src/parsers/microserviceParser.js`**
- **Purpose**: Microservice detection and routing
- **Responsibilities**:
  - Detect framework (Express/NestJS/Fastify)
  - Route to appropriate framework analyzer
- **Key Functions**:
  - `analyzeMicroservice()` - Detect and analyze

### Framework Analyzers

#### **`src/parsers/frameworks/ExpressFramework.js`**
- **Purpose**: Express.js security analyzer
- **Uses**:
  - `ASTExpressRouteParser` for route detection
  - `ASTFrameworkChecker` for config checks
- **Checks**:
  - Helmet middleware
  - CORS configuration
  - Rate limiting
  - Body size limits
  - Route authentication
  - Exposed endpoints

#### **`src/parsers/frameworks/NestJSFramework.js`**
- **Purpose**: NestJS security analyzer
- **Uses**:
  - `ASTNestJSRouteParser` for decorator-based routes
  - `ASTFrameworkChecker` for config checks
- **Checks**:
  - Guards (`@UseGuards`)
  - ValidationPipe
  - CORS configuration
  - Route-level security

#### **`src/parsers/frameworks/FastifyFramework.js`**
- **Purpose**: Fastify security analyzer
- **Uses**:
  - `ASTFastifyRouteParser` for route detection
  - `ASTFrameworkChecker` for config checks
- **Checks**:
  - Helmet plugin
  - CORS configuration
  - Rate limiting
  - Hooks and middleware

### AST Route Parsers

#### **`src/parsers/frameworks/ASTExpressRouteParser.js`**
- **Purpose**: Parse Express routes using AST
- **Algorithm**:
  1. Parse file into AST
  2. Track `express()` and `Router()` assignments
  3. Find route definitions using tracked variables
  4. Extract middleware chains
  5. Analyze authentication
- **Key Features**:
  - Works with any variable name
  - Handles `app.get()`, `router.post()`, `r.use()`, etc.
  - Extracts precise line numbers

#### **`src/parsers/frameworks/ASTNestJSRouteParser.js`**
- **Purpose**: Parse NestJS routes using AST
- **Algorithm**:
  1. Parse TypeScript file into AST
  2. Find `@Controller` decorators for base path
  3. Find `@Get`, `@Post`, etc. decorators for routes
  4. Extract `@UseGuards` for authentication
  5. Combine controller + route paths
- **Key Features**:
  - TypeScript-aware
  - Decorator extraction
  - Guard detection

#### **`src/parsers/frameworks/ASTFastifyRouteParser.js`**
- **Purpose**: Parse Fastify routes using AST
- **Algorithm**:
  1. Parse file into AST
  2. Track `fastify()` assignments
  3. Find route definitions
  4. Extract hooks and middleware
- **Key Features**:
  - Dynamic instance tracking
  - Hook detection

### AST Framework Checker

#### **`src/parsers/frameworks/ASTFrameworkChecker.js`**
- **Purpose**: AST-based framework configuration checks
- **Functions**:
  - `checkHelmetAST()` - Detect helmet usage
  - `checkCORSAST()` - Detect CORS misconfig
  - `checkRateLimitingAST()` - Detect rate limiting
  - `checkBodySizeLimitAST()` - Detect body limits
  - `checkValidationPipeAST()` - Detect ValidationPipe (NestJS)
  - `checkExposedEndpointsAST()` - Detect debug endpoints

### Route Analyzer

#### **`src/parsers/frameworks/RouteAnalyzer.js`**
- **Purpose**: Route data structures and utilities
- **Classes**:
  - `Route` - Single route representation
  - `RouteCollection` - Collection of routes with queries
  - `AuthTypeDetector` - Detect authentication type (JWT, Session, etc.)
- **Key Methods**:
  - `getAuthenticated()` - Get protected routes
  - `getUnauthenticated()` - Get unprotected routes
  - `getPublic()` - Get intentionally public routes
  - `isLikelyPublicRoute()` - Heuristics for public routes
  - `isLikelySensitiveRoute()` - Heuristics for sensitive routes

### Reporters

#### **`src/reporters/routeReporter.js`**
- **Purpose**: Format route analysis as table
- **Functions**:
  - `printRouteTable()` - Display routes in table format
  - `printRouteSummary()` - Display security summary
- **Features**:
  - Color-coded output (green=protected, yellow=unprotected, gray=public)
  - Aligned columns
  - Route statistics

#### **`src/reporters/jsonReporter.js`**
- **Purpose**: Format findings as JSON
- **Functions**:
  - `generateReport()` - Convert findings to JSON
  - `saveReport()` - Save to file

### Rules

#### **`src/rules/registry.js`**
- **Purpose**: Security rules and finding creation
- **Functions**:
  - `createFinding()` - Create standardized finding object
- **Finding Structure**:
  ```javascript
  {
    rule: "INSECURE_HTTP",
    file: "/path/to/file.js",
    line: 42,
    message: "HTTP connection instead of HTTPS",
    severity: "MEDIUM"
  }
  ```

---

## 📊 Example Output

### Command:
```bash
microsec-scan -p ~/dev/E-commerce/services/Auth --show-routes
```

### Output:

```
🚀 Scanning /home/yousef/dev/E-commerce/services/Auth ...
📂 Scanning directory: /home/yousef/dev/E-commerce/services/Auth

📍 Route Analysis: /home/yousef/dev/E-commerce/services/Auth
   Total routes: 10 | Authenticated: 5 | Public: 5 | Unprotected: 0

   Route                                          Authenticated     Type
   ─────────────────────────────────────────────────────────────────────────────────────
   GET    /admin/ping                              Yes             JWT
   POST   /auth/client-token                       Public          N/A (Public)
   POST   /auth/login                              Public          N/A (Public)
   POST   /auth/logout                             Public          N/A (Public)
   POST   /auth/refresh                            Public          N/A (Public)
   GET    /auth/userinfo                           Yes             JWT
   GET    /auth/validate                           Yes             JWT
   GET    /health                                  Public          N/A (Public)
   POST   /internal/users/provision                Yes             JWT
   PATCH  /internal/users/update                   Yes             JWT


🔍 Route Security Summary:
   ✅ Public routes (5):
      POST   /auth/client-token
      POST   /auth/login
      POST   /auth/logout
      POST   /auth/refresh
      GET    /health
   ✅ All non-public routes are protected


=== Security Scan Report ===

📄 /home/yousef/dev/E-commerce/services/Auth
  ├─ [MISSING_BODY_SIZE_LIMIT] Body parser missing size limit (vulnerable to large payload attacks) (MEDIUM)
  ├─ [MISSING_HELMET] App missing helmet middleware for security headers (HIGH)
  ├─ [MISSING_RATE_LIMITING] App missing rate limiting middleware (HIGH)

📄 /home/yousef/dev/E-commerce/services/Auth/src/app.js
  ├─ [PERMISSIVE_CORS] CORS configured with overly permissive origin (allows all domains) (line 12) (MEDIUM)

📄 /home/yousef/dev/E-commerce/services/Auth/src/routes/auth.routes.js
  ├─ [EXPOSED_INTERNAL_ENDPOINT] Potentially exposed debug/internal endpoint detected (line 20) (HIGH)
  ├─ [EXPOSED_INTERNAL_ENDPOINT] Potentially exposed debug/internal endpoint detected (line 112) (HIGH)
  ├─ [EXPOSED_INTERNAL_ENDPOINT] Potentially exposed debug/internal endpoint detected (line 145) (HIGH)
  ├─ [HARDCODED_SECRET] Potential hardcoded secret in property 'token_type' (line 138) (HIGH)

📄 /home/yousef/dev/E-commerce/services/Auth/src/config.js
  ├─ [PLAINTEXT_BROKER] RabbitMQ uses non-TLS amqp:// connection (line 40) (HIGH)

✅ Total issues: 9

✅ Scan complete: 9 issues found.
```

### Full Project Scan:
```bash
microsec-scan -p ~/dev/E-commerce --show-routes
```

**Scans all microservices:**
- Auth Service (10 routes)
- Users Service (5 routes)
- Payment Service (3 routes)
- Shipping Service (4 routes)
- Notifications Service (5 routes)

**Total: 27 routes analyzed, 62 security issues found**

---

## 🎯 Key Advantages of AST-Based Approach

### 1. **Framework-Agnostic**
```javascript
// All of these work:
const app = express();
const server = express();
const myCustomApp = express();
const api = express();
```

### 2. **Precise Line Numbers**
```javascript
// AST provides exact location
path.node.loc.start.line  // ← Line 42
```

### 3. **Context-Aware**
```javascript
// Understands code structure
if (callee.type === 'MemberExpression' &&
    callee.object.name === trackedVariable) {
  // This is a route on our tracked Express app!
}
```

### 4. **Robust**
```javascript
// Handles complex code
const app = express();
const router = Router();
app.use('/api', router);  // ← Understands mounting
router.get('/users', auth, handler);  // ← Extracts middleware
```

---

## 🚀 Usage

### Basic Scan:
```bash
microsec-scan -p /path/to/project
```

### With Route Analysis:
```bash
microsec-scan -p /path/to/project --show-routes
```

### Verbose Output:
```bash
microsec-scan -p /path/to/project --verbose --show-routes
```

### JSON Output:
```bash
microsec-scan -p /path/to/project --format json --output report.json
```

---

## 📈 Statistics

- **Total Lines of Code**: ~5,000
- **AST Parsers**: 4 (Express, NestJS, Fastify, Code)
- **Security Rules**: 25+
- **Frameworks Supported**: 3 (Express, NestJS, Fastify)
- **Container Support**: Docker Compose
- **AST Coverage**: 100% (no regex for code analysis)

---

## 🔧 Dependencies

- **@babel/parser** - JavaScript/TypeScript AST parser
- **@babel/traverse** - AST traversal
- **js-yaml** - YAML parser for Docker Compose
- **chalk** - Terminal colors
- **glob** - File pattern matching

---

## 📚 Further Reading

- [AST Parsing Guide](./AST_PARSING_GUIDE.md) - Learn about AST concepts
- [Babel Parser Docs](https://babeljs.io/docs/babel-parser)
- [AST Explorer](https://astexplorer.net/) - Interactive AST viewer

---

**Built with ❤️ using AST-based analysis for maximum accuracy and flexibility.**
