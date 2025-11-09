# Quick Reference - How the Scanner Works

## 🚀 One-Sentence Summary
AST-based security scanner that analyzes Node.js microservices for vulnerabilities in code, infrastructure, and inter-service communication.

---

## 📊 Execution Flow (Visual)

```
┌─────────────────────────────────────────────────────────────┐
│  1. CLI Entry (bin/microsec-scan.js)                        │
│     Command: microsec-scan scan -p ./services --show-egress │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  2. Scanner Orchestrator (src/scanner.js)                   │
│     • Finds all package.json files                          │
│     • Each directory with package.json = 1 microservice     │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  3. Framework Detection (src/parsers/microserviceParser.js) │
│     • Checks package.json dependencies                      │
│     • Detects: Express, Fastify, or NestJS                  │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  4. Framework Analysis (src/parsers/frameworks/)            │
│     Example: ExpressFramework.js                            │
│                                                              │
│     A. Route Discovery                                      │
│        • AST parses: app.get(), router.post()              │
│        • Tracks middleware chains                           │
│                                                              │
│     B. Egress Analysis ★ MAIN COMPONENT                     │
│        • Detects outbound calls                             │
│        • HTTP: axios(), fetch()                             │
│        • Kafka: producer.send(), new Kafka()                │
│        • RabbitMQ: channel.publish()                        │
│                                                              │
│     C. Infrastructure Checks                                │
│        • Helmet, CORS, Rate Limiting                        │
│        • Body size limits                                    │
│                                                              │
│     D. Security Validation                                  │
│        • Missing auth headers                               │
│        • Unencrypted connections                            │
│        • Missing circuit breakers                           │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  5. Rule Validation (src/rules/registry.js)                │
│     • 30+ security rules                                    │
│     • Severities: critical > high > medium > low            │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  6. Report Output (src/scanner.js)                          │
│     • Groups by file                                        │
│     • Color-codes by severity                               │
│     • Shows inter-service summary                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 Core Component: Egress Analyzer

**File**: `src/egress/ASTEgressAnalyzer.js`

### What It Does
Detects ALL outbound connections from microservices and validates their security.

### How It Works

#### Step 1: Parse JavaScript/TypeScript
```javascript
// Uses Babel to create Abstract Syntax Tree (AST)
const ast = parse(code, { plugins: ['typescript', 'jsx'] });
```

#### Step 2: Traverse AST & Detect Patterns
```javascript
traverse(ast, {
  CallExpression(path) {
    detectHTTPCalls()      // axios, fetch
    detectKafka()          // producer.send, consumer.subscribe
    detectRabbitMQ()       // channel.publish
  }
});
```

#### Step 3: Security Validation
```javascript
For each detected connection:
  ✓ Is it internal? (localhost, 192.168.x.x)
  ✗ Missing authentication?    → MISSING_SERVICE_AUTH
  ✗ Using HTTP (not HTTPS)?    → EGRESS_INSECURE_HTTP
  ✗ No circuit breaker?        → MISSING_CIRCUIT_BREAKER
  ✗ No mTLS?                   → MISSING_MUTUAL_TLS
```

---

## 🆕 Your Kafka Feature

### What You Added
Complete Kafka security analysis for Node.js microservices.

### Detection Examples

**1. Producer Operations**
```javascript
// Code being scanned:
await producer.send({
  topic: 'user-events',
  messages: [{ value: JSON.stringify(data) }]
});

// Scanner detects:
✗ No Avro/Protobuf → KAFKA_MISSING_SCHEMA_VALIDATION
```

**2. Consumer Operations**
```javascript
// Code being scanned:
await consumer.subscribe({ topic: 'orders' });

// Scanner tracks topic and validates config
```

**3. Client Configuration**
```javascript
// Code being scanned:
const kafka = new Kafka({
  brokers: ['localhost:9092'],
  ssl: false,    // ⚠️ 
  sasl: null     // ⚠️
});

// Scanner detects:
✗ ssl: false → KAFKA_PLAINTEXT (HIGH)
✗ no sasl → KAFKA_MISSING_SASL (HIGH)
```

### Rules You Added
1. **KAFKA_PLAINTEXT** (HIGH) - No SSL/TLS encryption
2. **KAFKA_MISSING_SASL** (HIGH) - No authentication
3. **KAFKA_MISSING_SCHEMA_VALIDATION** (MEDIUM) - No Avro/Protobuf
4. **EGRESS_INSECURE_KAFKA** (HIGH) - Unencrypted connection

### Files Modified
1. `src/rules/registry.js` - Added 4 new rules
2. `src/egress/ASTEgressAnalyzer.js` - Added `detectKafka()` + `checkKafkaConfig()`
3. `src/egress/EgressModels.js` - Added Kafka support to data models
4. `src/egress/EgressReporter.js` - Added Kafka to reports
5. `src/scanner.js` - Added Kafka rules to inter-service summary

---

## 🎯 Key Technical Concepts

### AST (Abstract Syntax Tree)
**What**: Tree representation of code structure
**Why**: Can detect patterns regex can't (dynamic code, template literals)

**Example**:
```javascript
// Code:
axios(`http://localhost:${port}/users`)

// AST sees:
CallExpression
  ├─ callee: Identifier("axios")
  └─ arguments: [TemplateLiteral]
      ├─ quasis: ["http://localhost:", "/users"]
      └─ expressions: [Identifier("port")]

// Scanner can extract: "http://localhost:${port}/users"
```

### Framework Detection
**How**: Checks `package.json` dependencies
```javascript
detect() {
  return this.hasPackage("express");
}
```

### Internal vs External Services
```javascript
isInternalService(url) {
  // Internal (strict checks):
  "http://localhost:3000"           ✓
  "http://192.168.1.50:8080"        ✓
  "http://user-service:3001"        ✓
  
  // External (different rules):
  "https://api.stripe.com"          ✗
  "https://api.github.com"          ✗
}
```

---

## 📝 Example Scan Output

```bash
$ microsec-scan scan -p ./microservices -e

📂 Scanning directory: ./microservices

🔍 Analyzing service: kafka-producer
   Framework: Express
   ⚠️  Found 5 security issues

📡 Egress Analysis: kafka-producer
   Total: 3 | Kafka: 2 | HTTP: 1

   TYPE     METHOD    RULE                              SEVERITY   TARGET
   ─────────────────────────────────────────────────────────────────────
   KAFKA    send      KAFKA_MISSING_SCHEMA_VALIDATION   MEDIUM     topic:user-events
   KAFKA    send      KAFKA_PLAINTEXT                   HIGH       topic:user-events
   HTTP     GET       MISSING_SERVICE_AUTH              CRITICAL   http://localhost:3000

=== Security Scan Report ===

📄 /microservices/kafka-producer/producer.js
  ├─ [KAFKA_PLAINTEXT] Kafka client without SSL/TLS (line 10) (HIGH)
  ├─ [KAFKA_MISSING_SASL] Kafka client without SASL auth (line 10) (HIGH)
  ├─ [KAFKA_MISSING_SCHEMA_VALIDATION] Kafka send() without schema validation (line 25) (MEDIUM)

📄 /microservices/kafka-producer/api.js
  ├─ [MISSING_SERVICE_AUTH] Call to http://localhost:3000 without auth (line 15) (CRITICAL)
  ├─ [MISSING_CIRCUIT_BREAKER] No circuit breaker pattern (line 15) (MEDIUM)

✅ Scan complete: 5 issues found.

📊 Inter-Service Security Summary:
   Total Inter-Service Issues: 5
   ────────────────────────────────────────
   🔴 KAFKA_PLAINTEXT: 1
   🔴 KAFKA_MISSING_SASL: 1
   🔴 MISSING_SERVICE_AUTH: 1
   🟡 KAFKA_MISSING_SCHEMA_VALIDATION: 1
   🟡 MISSING_CIRCUIT_BREAKER: 1
```

---

## 🎓 For Your Supervisors

### The Problem
Microservices have complex inter-service communication that traditional security scanners miss:
- Service-to-service authentication
- Message broker encryption
- Circuit breaker patterns
- Request signing

### Our Solution
AST-based scanner that:
1. **Detects** all outbound connections (HTTP, Kafka, RabbitMQ)
2. **Validates** security configurations
3. **Reports** issues with actionable information

### Your Contribution
Added comprehensive Kafka security analysis:
- Encryption validation (SSL/TLS)
- Authentication checking (SASL)
- Schema validation detection
- Integration with existing framework

### Business Impact
- ✅ Catches security issues before production
- ✅ Reduces attack surface in microservice architectures
- ✅ Provides clear, actionable findings
- ✅ Supports modern message brokers (RabbitMQ + Kafka)

---

## 🔧 Technical Stack

- **Language**: Node.js (ES Modules)
- **AST Parser**: Babel Parser
- **AST Traversal**: @babel/traverse
- **CLI**: Commander.js
- **Styling**: Chalk (terminal colors)
- **File System**: glob (pattern matching)

---

## 📚 Further Reading

- **Full Architecture**: See `ARCHITECTURE.md`
- **Source Code**: Entry point at `bin/microsec-scan.js`
- **Rules**: Complete list in `src/rules/registry.js`
- **Kafka Implementation**: `src/egress/ASTEgressAnalyzer.js` (lines 207-357)
