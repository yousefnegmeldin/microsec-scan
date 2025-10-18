# AST Parsing Guide: Understanding Abstract Syntax Trees

## 📚 What is AST?

**AST (Abstract Syntax Tree)** is a tree representation of the structure of source code. It's called "abstract" because it doesn't include every detail of the syntax (like semicolons, parentheses), but focuses on the **semantic structure** of the code.

## 🌳 Visual Example

### JavaScript Code:
```javascript
const app = express();
app.get('/users', handler);
```

### AST Representation:
```
Program
├── VariableDeclaration (const)
│   └── VariableDeclarator
│       ├── Identifier: "app"
│       └── CallExpression
│           └── Identifier: "express"
│
└── ExpressionStatement
    └── CallExpression
        ├── MemberExpression
        │   ├── Object: Identifier "app"
        │   └── Property: Identifier "get"
        └── Arguments
            ├── StringLiteral: "/users"
            └── Identifier: "handler"
```

## 🔍 Why Use AST Parsing?

### ❌ Without AST (Regex-based):
```javascript
// Fragile - breaks easily
const routeRegex = /app\.get\(['"`]([^'"`]+)['"`]/;
```

**Problems:**
- Assumes variable is named `app`
- Can't handle complex expressions
- Breaks with formatting changes
- No understanding of scope

### ✅ With AST:
```javascript
// Robust - understands code structure
traverse(ast, {
  VariableDeclarator(path) {
    if (isExpressApp(path.node.init)) {
      trackVariable(path.node.id.name); // Track ANY variable name
    }
  }
});
```

**Benefits:**
- Works with any variable name
- Understands scope and context
- Handles complex expressions
- Resilient to formatting

## 🛠️ How AST Parsing Works

### Step 1: Lexical Analysis (Tokenization)
Breaks code into tokens:
```javascript
const app = express();
```
Becomes:
```
[KEYWORD: const] [IDENTIFIER: app] [OPERATOR: =] [IDENTIFIER: express] [PUNCTUATOR: (] [PUNCTUATOR: )] [PUNCTUATOR: ;]
```

### Step 2: Syntactic Analysis (Parsing)
Builds the tree structure from tokens.

### Step 3: Traversal
Walk through the tree to find patterns.

### Step 4: Analysis
Extract information or transform code.

## 📦 Popular JavaScript AST Parsers

### 1. **Babel Parser** (@babel/parser)
- Most popular
- Supports latest JavaScript features
- TypeScript support
- Used by Babel compiler

```bash
npm install @babel/parser @babel/traverse
```

### 2. **Acorn**
- Lightweight
- Fast
- Standard-compliant
- Used by webpack, rollup

```bash
npm install acorn acorn-walk
```

### 3. **ESPrima**
- Educational
- Well-documented
- Slower than Acorn

### 4. **SWC Parser**
- Rust-based (super fast)
- Modern alternative

## 💻 Practical Example

### Code to Analyze:
```javascript
const myApp = express();
const apiRouter = Router();

myApp.get('/health', (req, res) => res.json({ ok: true }));
apiRouter.post('/users', authenticate, createUser);
```

### Using Babel Parser:
```javascript
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

const code = `
  const myApp = express();
  const apiRouter = Router();
  
  myApp.get('/health', handler);
  apiRouter.post('/users', authenticate, handler);
`;

// Step 1: Parse code into AST
const ast = parse(code, {
  sourceType: 'module',
  plugins: ['jsx', 'typescript']
});

// Step 2: Track Express variables
const expressVars = new Set();
const routerVars = new Set();

traverse(ast, {
  // Find: const X = express()
  VariableDeclarator(path) {
    const init = path.node.init;
    if (init?.type === 'CallExpression') {
      if (init.callee.name === 'express') {
        expressVars.add(path.node.id.name); // Track "myApp"
      }
      if (init.callee.name === 'Router') {
        routerVars.add(path.node.id.name); // Track "apiRouter"
      }
    }
  }
});

console.log('Express apps:', expressVars);    // Set { 'myApp' }
console.log('Routers:', routerVars);          // Set { 'apiRouter' }

// Step 3: Find routes using tracked variables
const routes = [];

traverse(ast, {
  // Find: X.get('/path', ...)
  CallExpression(path) {
    const callee = path.node.callee;
    
    if (callee.type === 'MemberExpression') {
      const objectName = callee.object.name;
      const method = callee.property.name;
      
      // Check if it's a tracked Express variable
      if (expressVars.has(objectName) || routerVars.has(objectName)) {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
          const routePath = path.node.arguments[0]?.value;
          const middleware = path.node.arguments.slice(1).map(arg => arg.name);
          
          routes.push({
            variable: objectName,
            method: method.toUpperCase(),
            path: routePath,
            middleware: middleware
          });
        }
      }
    }
  }
});

console.log('Routes found:', routes);
// [
//   { variable: 'myApp', method: 'GET', path: '/health', middleware: ['handler'] },
//   { variable: 'apiRouter', method: 'POST', path: '/users', middleware: ['authenticate', 'handler'] }
// ]
```

## 🎯 AST Node Types (Common)

### Variable Declaration:
```javascript
const app = express();
```
```json
{
  "type": "VariableDeclaration",
  "kind": "const",
  "declarations": [{
    "type": "VariableDeclarator",
    "id": { "type": "Identifier", "name": "app" },
    "init": {
      "type": "CallExpression",
      "callee": { "type": "Identifier", "name": "express" }
    }
  }]
}
```

### Member Expression:
```javascript
app.get('/users', handler)
```
```json
{
  "type": "CallExpression",
  "callee": {
    "type": "MemberExpression",
    "object": { "type": "Identifier", "name": "app" },
    "property": { "type": "Identifier", "name": "get" }
  },
  "arguments": [
    { "type": "StringLiteral", "value": "/users" },
    { "type": "Identifier", "name": "handler" }
  ]
}
```

## 🔗 Useful Resources

### Official Documentation:
- **Babel Parser**: https://babeljs.io/docs/babel-parser
- **Babel Traverse**: https://babeljs.io/docs/babel-traverse
- **AST Explorer** (Interactive): https://astexplorer.net/
- **ESTree Spec**: https://github.com/estree/estree

### Learning Resources:
- **"The Super Tiny Compiler"**: https://github.com/jamiebuilds/the-super-tiny-compiler
  - Educational compiler in ~200 lines
  - Explains AST concepts step-by-step

- **"Babel Plugin Handbook"**: https://github.com/jamiebuilds/babel-handbook
  - Deep dive into AST manipulation
  - Practical examples

- **AST Explorer**: https://astexplorer.net/
  - Paste code, see AST in real-time
  - Try different parsers
  - Essential learning tool

### Video Tutorials:
- "AST for Beginners" by Kent C. Dodds
- "Writing Custom Babel Plugins" by Tan Li Hau

## 🚀 Our Implementation Plan

### Phase 1: Variable Tracking
```javascript
// Track: const myApp = express()
const expressApps = new Map(); // varName -> metadata
const routers = new Map();     // varName -> metadata
```

### Phase 2: Route Detection
```javascript
// Find: myApp.get('/path', middleware, handler)
// Using tracked variable names dynamically
```

### Phase 3: Middleware Analysis
```javascript
// Analyze middleware chain for auth patterns
// Track: authenticate, verifyToken, etc.
```

### Phase 4: Scope Handling
```javascript
// Handle imports, exports, nested scopes
// Track variables across files (if needed)
```

## 📝 Key Takeaways

1. **AST = Code Structure as Data** - Treat code like a data structure you can query
2. **More Robust than Regex** - Understands syntax, not just patterns
3. **Framework Agnostic** - Works regardless of naming conventions
4. **Industry Standard** - Used by all major tools (ESLint, Prettier, Babel, TypeScript)
5. **Learning Curve** - Takes time but worth it for complex analysis

## 🎓 Next Steps

1. **Play with AST Explorer**: https://astexplorer.net/
   - Paste your Express code
   - See the AST structure
   - Understand node types

2. **Read Babel Docs**: Start with basics
   - How to parse
   - How to traverse
   - Common patterns

3. **Build Small Examples**: Practice with simple cases
   - Track variable assignments
   - Find function calls
   - Extract strings

4. **Implement in Scanner**: Apply to our use case
   - Parse Express files
   - Track variables
   - Extract routes

---

**Ready to implement AST-based route parsing?** 🚀
