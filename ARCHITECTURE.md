# Microservices Security Scanner - Architecture & Flow

## Executive Summary
AST-based static analysis tool for Node.js microservices that detects security vulnerabilities in code, infrastructure, and inter-service communication.

## System Architecture

```
bin/microsec-scan.js (CLI Entry)
    ↓
src/scanner.js (Orchestrator)
    ↓
    ├─→ Service Discovery (finds package.json)
    ├─→ Framework Detection (Express/Fastify/NestJS)
    └─→ Multi-Layer Analysis
         ├─→ Route Analysis (endpoints, middleware)
         ├─→ Egress Analysis (outbound connections)
         ├─→ Infrastructure Checks (helmet, CORS, rate limiting)
         └─→ Inter-Service Security (auth, mTLS, circuit breakers)
    ↓
src/rules/registry.js (Rule Validation)
    ↓
Console Report (color-coded by severity)
```

---

## Detailed Execution Flow

### Phase 1: CLI & Initialization
**File**: `bin/microsec-scan.js`

1. **Node Version Check**: Requires Node.js v18+
2. **Command Parsing**: Uses Commander.js
   ```bash
   microsec-scan scan -p ./microservices -v --show-egress
   ```
3. **Dispatch**: Calls `runScanner()` from `src/scanner.js`

---

### Phase 2: Service Discovery
**File**: `src/scanner.js` (lines 18-48)

```javascript
// 1. Glob all files (excludes node_modules, dist, .git)
const files = await glob(`${baseDir}/**/*`, { ignore: [...] });

// 2. Find microservice directories (has package.json)
const serviceDirs = new Set();
for (const file of filteredFiles) {
  if (file.endsWith("package.json")) {
    serviceDirs.add(path.dirname(file));
  }
}
```

**Output**: Set of service directories

---

### Phase 3: Framework-Aware Analysis
**File**: `src/parsers/microserviceParser.js`

For each service directory:

1. **Instantiate Framework Analyzers**:
   ```javascript
   const frameworks = [
     new ExpressFramework(serviceDir),
     new FastifyFramework(serviceDir),
     new NestJSFramework(serviceDir),
   ];
   ```

2. **Auto-Detect Framework** (checks package.json dependencies):
   ```javascript
   const detectedFrameworks = frameworks.filter(fw => fw.detect());
   ```

3. **Run Framework-Specific Analysis**:
   ```javascript
   framework.analyze() → findings[]
   ```

---

### Phase 4: Express Framework Analysis
**File**: `src/parsers/frameworks/ExpressFramework.js`

#### 4.1 Route Discovery
**Component**: `ASTExpressRouteParser`

```javascript
// Detects:
app.get('/users', authMiddleware, handler)
router.post('/orders', validateBody, handler)
app.use('/api', apiRouter)
```

**Tracks**:
- HTTP method & path
- Middleware chain (authentication, validation)
- File & line number

#### 4.2 Egress Analysis (Critical Component)
**Component**: `ASTEgressAnalyzer`
**File**: `src/egress/ASTEgressAnalyzer.js`

**Step 1: Parse with Babel**
```javascript
const ast = parse(content, {
  sourceType: 'module',
  plugins: ['jsx', 'typescript', 'decorators-legacy']
});
```

**Step 2: Traverse AST & Detect Patterns**

**HTTP Calls**:
```javascript
// Detects:
axios.get('http://localhost:3000/users')
axios.post('https://api.stripe.com/charges')
axios(`http://localhost:4000/orders/${id}`)  // ← Direct call fix
fetch('https://external.com/data')
```

**Kafka Operations** (YOUR FEATURE):
```javascript
// Detects:
producer.send({ topic: 'user-events', messages: [...] })
consumer.subscribe({ topic: 'orders' })
new Kafka({
  brokers: ['localhost:9092'],
  ssl: false,  // ← Security issue!
  sasl: null   // ← Security issue!
})
```

**RabbitMQ Operations**:
```javascript
// Detects:
channel.publish('exchange', 'routing-key', buffer)
channel.sendToQueue('queue-name', buffer)
amqplib.connect('amqp://localhost')  // ← Insecure!
```

**Step 3: Inter-Service Security Validation**

For each detected connection, checks:

```javascript
if (isInternalService(url)) {  // localhost, 192.168.x.x, :3000
  ✗ No Authorization header     → MISSING_SERVICE_AUTH
  ✗ No httpsAgent (mTLS)        → MISSING_MUTUAL_TLS  
  ✗ No circuit breaker          → MISSING_CIRCUIT_BREAKER
  ✗ No HMAC/signature           → MISSING_REQUEST_SIGNING
}
```

**Kafka-Specific Checks**:
```javascript
checkKafkaConfig(configNode) {
  ✗ ssl: false or missing       → KAFKA_PLAINTEXT
  ✗ sasl: missing               → KAFKA_MISSING_SASL
  ✗ No Avro/Protobuf            → KAFKA_MISSING_SCHEMA_VALIDATION
}
```

#### 4.3 Infrastructure Checks

**Helmet** (Security Headers):
```javascript
checkHelmet() → scans for app.use(helmet())
```

**Rate Limiting**:
```javascript
checkRateLimiting() → scans for express-rate-limit
```

**CORS**:
```javascript
checkCORS() → flags origin: '*' as PERMISSIVE_CORS
```

**Body Size Limits**:
```javascript
checkBodySizeLimits() → checks express.json({ limit: '...' })
```

#### 4.4 Route Security
```javascript
checkRouteAuthentication() {
  // Flags unprotected sensitive routes:
  GET /admin → No auth middleware → UNPROTECTED_ROUTE
  GET /api/users/:id → No auth → UNPROTECTED_ROUTE
}
```

---

### Phase 5: Rule Validation
**File**: `src/rules/registry.js`

**Structure**:
```javascript
export const RULES = {
  KAFKA_PLAINTEXT: {
    id: "KAFKA_PLAINTEXT",
    severity: "high",
    description: "Kafka connection without SSL/TLS encryption"
  },
  MISSING_SERVICE_AUTH: {
    id: "MISSING_SERVICE_AUTH",
    severity: "critical",
    description: "Service-to-service call without authentication"
  },
  // ... 30+ rules
};
```

**Helper**:
```javascript
createFinding(ruleId, file, line, additionalMessage) {
  return {
    rule: RULES[ruleId].id,
    severity: RULES[ruleId].severity,
    message: additionalMessage || RULES[ruleId].description,
    file: file,
    line: line
  };
}
```

---

### Phase 6: Reporting
**File**: `src/scanner.js` (lines 110-166)

**Groups findings**:
```javascript
const groupedByFile = findings.reduce((acc, f) => {
  acc[f.file] = acc[f.file] || [];
  acc[f.file].push(f);
  return acc;
}, {});
```

**Color-codes by severity**:
```javascript
critical → chalk.red.bold (🔴)
high     → chalk.red (🔴)
medium   → chalk.yellow (🟡)
low      → chalk.gray (⚪)
```

**Example Output**:
```
📄 /path/to/kafka-producer.js
  ├─ [KAFKA_PLAINTEXT] Kafka connection without SSL/TLS encryption (line 10) (HIGH)
  ├─ [KAFKA_MISSING_SASL] Kafka connection without SASL authentication (line 10) (HIGH)
  ├─ [KAFKA_MISSING_SCHEMA_VALIDATION] Kafka send() without schema validation (line 20) (MEDIUM)

📄 /path/to/api-handler.js
  ├─ [MISSING_SERVICE_AUTH] Service-to-service call to http://localhost:4000/users without authentication (line 15) (CRITICAL)
  ├─ [MISSING_CIRCUIT_BREAKER] Service-to-service call without circuit breaker (line 15) (MEDIUM)

✅ Total issues: 16

📊 Inter-Service Security Summary:
   Total Inter-Service Issues: 8
   ────────────────────────────────────────
   🔴 MISSING_SERVICE_AUTH: 4
   🟠 KAFKA_PLAINTEXT: 2
   🟡 MISSING_CIRCUIT_BREAKER: 2
```

---

## Key Technical Innovations

### 1. AST-Based Analysis
- **Why**: Regex/text search misses dynamic code
- **How**: Babel parser + AST traversal
- **Benefit**: Catches `axios(url)`, template literals, variable references

### 2. Context-Aware Detection
```javascript
isInternalService(url) {
  // Distinguishes internal vs external
  localhost:3000     → Internal (strict checks)
  api.stripe.com     → External (different rules)
  192.168.1.50:8080  → Internal
}
```

### 3. Framework Abstraction
- **BaseFramework** class → shared utilities
- **Framework-specific** classes → Express/Fastify/NestJS
- **Automatic detection** → checks package.json

### 4. Kafka Support (YOUR CONTRIBUTION)

**Detection Points**:
1. **Producer/Consumer operations**:
   ```javascript
   producer.send({ topic: 'events', ... })
   consumer.subscribe({ topic: 'orders' })
   ```

2. **Client configuration**:
   ```javascript
   new Kafka({ brokers: [...], ssl: true, sasl: {...} })
   ```

3. **Security checks**:
   - SSL/TLS encryption
   - SASL authentication
   - Schema validation (Avro/Protobuf)

**Rules Added**:
- `KAFKA_PLAINTEXT` (HIGH)
- `KAFKA_MISSING_SASL` (HIGH)
- `KAFKA_MISSING_SCHEMA_VALIDATION` (MEDIUM)
- `EGRESS_INSECURE_KAFKA` (HIGH)

---

## Data Flow Diagram

```
User Input (CLI)
    ↓
File System Scan
    ↓
Service Discovery (package.json)
    ↓
For Each Service:
    ↓
    Framework Detection
    (Express/Fastify/NestJS)
    ↓
    ┌──────────────────────┐
    │  Framework Analyzer  │
    └──────────────────────┘
            ↓
    ┌──────────────────┬──────────────────┐
    ↓                  ↓                  ↓
Route Parser    Egress Analyzer   Infrastructure Checker
    ↓                  ↓                  ↓
  Routes          Connections        Middleware
  ├─ GET /users   ├─ HTTP calls     ├─ Helmet
  ├─ POST /orders ├─ Kafka ops      ├─ CORS
  └─ auth status  └─ RabbitMQ ops   └─ Rate limiting
    ↓                  ↓                  ↓
    └──────────────────┴──────────────────┘
                    ↓
            Security Validation
            (rules/registry.js)
                    ↓
            Findings Collection
                    ↓
            Console Report
            (grouped & color-coded)
```

---

## File Structure

```
microsec-scan/
├── bin/
│   └── microsec-scan.js          # CLI entry point
├── src/
│   ├── scanner.js                # Main orchestrator
│   ├── parsers/
│   │   ├── microserviceParser.js # Framework detection
│   │   ├── ASTCodeParser.js      # Generic code analysis
│   │   ├── composeParser.js      # Docker Compose analysis
│   │   └── frameworks/
│   │       ├── BaseFramework.js
│   │       ├── ExpressFramework.js
│   │       ├── FastifyFramework.js
│   │       └── NestJSFramework.js
│   ├── egress/
│   │   ├── ASTEgressAnalyzer.js  # Outbound connection detector
│   │   ├── EgressModels.js       # Data models
│   │   └── EgressReporter.js     # Egress reporting
│   ├── rules/
│   │   └── registry.js           # Security rules definition
│   └── reporters/
│       └── routeReporter.js      # Route analysis reporting
```

---

## Summary for Supervisors

**What it does**: Scans Node.js microservices for security vulnerabilities

**How it works**: 
1. Parses JavaScript/TypeScript code into AST (Abstract Syntax Tree)
2. Detects security-relevant patterns (routes, HTTP calls, message brokers)
3. Validates against 30+ security rules
4. Reports issues with severity levels

**Key features**:
- ✅ Framework-aware (Express, Fastify, NestJS)
- ✅ Inter-service security analysis
- ✅ Message broker support (RabbitMQ, **Kafka**)
- ✅ Infrastructure checks (Helmet, CORS, rate limiting)
- ✅ AST-based (catches dynamic code patterns)

**Your contribution**: Added comprehensive Kafka security analysis
- Detects Kafka producers/consumers
- Validates SSL/TLS and SASL configuration
- Checks for schema validation (Avro/Protobuf)

**Impact**: Helps DevSecOps teams identify vulnerabilities before production deployment
