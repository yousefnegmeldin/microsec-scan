# Egress/Output Analysis

## 📡 Overview

The **Egress Analysis** module tracks all outbound connections from your microservices, including:
- 🐰 **RabbitMQ** operations (publish, consume, sendToQueue)
- 🌐 **HTTP/HTTPS** calls to external APIs and internal services
- 🔒 **Security analysis** of outbound connections

## 🎯 Why Track Egress?

### Security Benefits:
1. **Detect Insecure Connections** - Find HTTP calls that should be HTTPS
2. **Map Service Dependencies** - Understand which services talk to each other
3. **Identify External APIs** - Track 3rd party integrations
4. **Audit Message Flows** - See RabbitMQ publish/consume patterns
5. **Compliance** - Document data flows for security audits

## 🚀 Usage

### Basic Egress Analysis:
```bash
microsec-scan -p /path/to/project --show-egress
```

### Combined with Route Analysis:
```bash
microsec-scan -p /path/to/project --show-routes --show-egress
```

### JSON Output:
```bash
microsec-scan -p /path/to/project --show-egress --format json --output egress-report.json
```

## 📊 Example Output

### Command:
```bash
microsec-scan -p ~/dev/E-commerce/services/Shipping --show-egress
```

### Output:
```
📡 Egress Analysis: /home/user/E-commerce/services/Shipping
   Total: 3 | RabbitMQ: 1 | HTTP: 2 | Insecure: 0 | External: 3

   Type         Method     Target                                             Security   Category
   ────────────────────────────────────────────────────────────────────────────────────────────────
   HTTPS        POST       https://api.easypost.com/v2/shipments              Secure     External API
   RABBITMQ     publish    shipping.created                                   Secure     Message Broker
   HTTPS        GET        https://api.easypost.com/v2/shipments/             Secure     External API


📊 Egress Summary by Category:

   External API (2):
      ✓ https://api.easypost.com/v2/shipments (POST)
      ✓ https://api.easypost.com/v2/shipments/ (GET)

   Message Broker (1):
      ✓ shipping.created (publish)

   ✅ All outbound connections are secure
```

### With Insecure Connections:
```
📡 Egress Analysis: /home/user/E-commerce/services/Users
   Total: 5 | RabbitMQ: 4 | HTTP: 1 | Insecure: 1 | External: 5

   Type         Method     Target                                             Security   Category
   ────────────────────────────────────────────────────────────────────────────────────────────────
   HTTP         UNKNOWN    http://auth:3001                                   Insecure   External API
   RABBITMQ     assertQueue variable:QUEUE_CREATE                             Secure     Message Broker
   RABBITMQ     consume    variable:queue                                     Secure     Message Broker


⚠️  Insecure Outbound Connections (1):

   ✗ HTTP to http://auth:3001
     File: /home/user/services/Users/src/app.js:14
     Context: string literal
```

## 🔍 What Gets Detected

### RabbitMQ Operations:
```javascript
// ✅ Detected
channel.publish('exchange', 'routing.key', message);
channel.sendToQueue('queue-name', message);
channel.consume('queue-name', handler);
channel.assertQueue('queue-name');

// ✅ Connection strings
amqplib.connect('amqp://rabbitmq:5672');
amqplib.connect('amqps://rabbitmq:5671'); // Secure
```

### HTTP/HTTPS Calls:
```javascript
// ✅ axios
axios.get('https://api.example.com/data');
axios.post('https://api.example.com/users', data);

// ✅ fetch
fetch('https://api.example.com/data');

// ✅ http/https modules
http.request('http://internal-service:3000');
https.request('https://external-api.com');

// ✅ Direct axios call
axios({ url: 'https://api.example.com' });
```

### URL Detection:
```javascript
// ✅ String literals
const apiUrl = 'https://api.stripe.com/v1/charges';

// ✅ Template literals
const url = `https://api.example.com/users/${id}`;
```

## 📁 File Structure

```
src/egress/
├── EgressModels.js          # Data structures
│   ├── EgressConnection     # Single connection model
│   └── EgressCollection     # Collection with queries
├── ASTEgressAnalyzer.js     # AST-based analyzer
│   ├── detectRabbitMQ()     # RabbitMQ detection
│   ├── detectHTTPCalls()    # HTTP/HTTPS detection
│   └── detectURLStrings()   # Static URL detection
└── EgressReporter.js        # Output formatting
    ├── printEgressTable()   # Table display
    ├── printEgressSummary() # Category summary
    └── printEgressWarnings() # Security warnings
```

## 🔬 How It Works (AST-Based)

### 1. RabbitMQ Detection:
```javascript
traverse(ast, {
  CallExpression(path) {
    // Detect: channel.publish()
    if (callee.property.name === 'publish') {
      const queueName = path.node.arguments[0].value;
      egress.add({
        type: 'rabbitmq',
        target: queueName,
        method: 'publish',
      });
    }
  }
});
```

### 2. HTTP Call Detection:
```javascript
traverse(ast, {
  CallExpression(path) {
    // Detect: axios.get(url)
    if (object === 'axios' && method === 'get') {
      const url = extractURL(path.node.arguments[0]);
      egress.add({
        type: inferProtocol(url), // 'http' or 'https'
        target: url,
        method: 'GET',
      });
    }
  }
});
```

### 3. Security Analysis:
```javascript
class EgressConnection {
  isSecure() {
    if (this.type === 'http') return false;
    if (this.target.startsWith('amqp://')) return false;
    return true;
  }

  isExternal() {
    const internal = ['localhost', '127.0.0.1', 'rabbitmq'];
    return !internal.some(p => this.target.includes(p));
  }
}
```

## 📊 Data Model

### EgressConnection:
```javascript
{
  type: 'rabbitmq' | 'http' | 'https',
  target: 'queue-name' | 'https://api.example.com',
  method: 'publish' | 'GET' | 'POST' | ...,
  file: '/path/to/file.js',
  line: 42,
  context: 'channel.publish()' | 'axios.get()',
  
  // Computed properties:
  isSecure: true | false,
  isExternal: true | false,
  category: 'Message Broker' | 'External API' | 'Internal Service'
}
```

### EgressCollection Methods:
```javascript
egress.getAll()           // All connections
egress.getRabbitMQ()      // Only RabbitMQ
egress.getHTTP()          // Only HTTP/HTTPS
egress.getInsecure()      // Insecure connections
egress.getExternal()      // External APIs
egress.getInternal()      // Internal services
egress.groupByTarget()    // Group by destination
egress.groupByCategory()  // Group by type
egress.getStats()         // Summary statistics
```

## 🎨 Categories

### 1. **Message Broker**
- RabbitMQ operations
- Queue names, exchanges
- Publish/consume patterns

### 2. **External API**
- 3rd party services (Stripe, SendGrid, etc.)
- Public APIs
- External integrations

### 3. **Internal Service**
- Microservice-to-microservice calls
- Internal HTTP endpoints
- Service mesh communication

## 🔒 Security Checks

### Insecure Connections:
- ❌ HTTP instead of HTTPS
- ❌ `amqp://` instead of `amqps://`
- ❌ Unencrypted message broker connections

### Secure Connections:
- ✅ HTTPS for external APIs
- ✅ `amqps://` for RabbitMQ
- ✅ TLS-encrypted connections

## 📈 Use Cases

### 1. **Service Dependency Mapping**
```bash
# See what each service connects to
microsec-scan -p ./services/auth --show-egress
microsec-scan -p ./services/payment --show-egress
microsec-scan -p ./services/shipping --show-egress
```

### 2. **Security Audit**
```bash
# Find all insecure connections
microsec-scan -p ./services --show-egress | grep "Insecure"
```

### 3. **External API Inventory**
```bash
# List all 3rd party integrations
microsec-scan -p ./services --show-egress --format json | jq '.connections[] | select(.external == true)'
```

### 4. **Message Flow Analysis**
```bash
# See RabbitMQ publish/consume patterns
microsec-scan -p ./services --show-egress --format json | jq '.connections[] | select(.type == "rabbitmq")'
```

## 🔧 Integration

### Express.js:
```javascript
// Automatically analyzed
const framework = new ExpressFramework(serviceDir);
framework.analyze();
const egress = framework.getEgress();
```

### NestJS & Fastify:
```javascript
// Coming soon - same pattern
const framework = new NestJSFramework(serviceDir);
framework.analyze();
const egress = framework.getEgress();
```

## 📝 JSON Output Format

```json
{
  "summary": {
    "total": 5,
    "rabbitmq": 3,
    "http": 2,
    "insecure": 1,
    "external": 4,
    "internal": 1
  },
  "connections": [
    {
      "type": "https",
      "target": "https://api.stripe.com/v1/charges",
      "method": "POST",
      "file": "/path/to/payment.js",
      "line": 42,
      "context": "axios.post()",
      "secure": true,
      "external": true,
      "category": "External API"
    },
    {
      "type": "rabbitmq",
      "target": "payment.created",
      "method": "publish",
      "file": "/path/to/payment.js",
      "line": 56,
      "context": "channel.publish()",
      "secure": true,
      "external": false,
      "category": "Message Broker"
    }
  ],
  "byCategory": {
    "External API": [...],
    "Message Broker": [...],
    "Internal Service": [...]
  }
}
```

## 🚀 Future Enhancements

- [ ] gRPC call detection
- [ ] GraphQL endpoint detection
- [ ] WebSocket connection tracking
- [ ] Redis pub/sub detection
- [ ] Kafka producer/consumer detection
- [ ] Database connection tracking
- [ ] Service mesh integration (Istio, Linkerd)

## 📚 Related Documentation

- [System Architecture](./SYSTEM_ARCHITECTURE.md) - Overall system design
- [AST Parsing Guide](./AST_PARSING_GUIDE.md) - How AST analysis works
- [Route Analysis](./SYSTEM_ARCHITECTURE.md#route-analysis) - Ingress analysis

---

**Built with AST-based analysis for accurate egress tracking** 🔥
