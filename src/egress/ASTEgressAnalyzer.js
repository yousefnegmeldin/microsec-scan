import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import { EgressConnection, EgressCollection } from "./EgressModels.js";

/**
 * AST-based egress/output analyzer.
 * Detects all outbound connections: RabbitMQ, HTTP/HTTPS, etc.
 */
export class ASTEgressAnalyzer {
  constructor(serviceDir, findJsFiles, readFile) {
    this.serviceDir = serviceDir;
    this.findJsFiles = findJsFiles;
    this.readFile = readFile;
    this.egress = new EgressCollection();
  }

  /**
   * Analyze all files for egress connections.
   */
  analyze() {
    const files = this.findJsFiles(this.serviceDir);

    for (const file of files) {
      const content = this.readFile(file);
      if (!content) continue;

      try {
        this.analyzeFile(file, content);
      } catch (err) {
        // Skip parse errors
        if (err.code !== 'BABEL_PARSE_ERROR') {
          console.error(`Egress parse error in ${file}:`, err.message);
        }
      }
    }

    return this.egress;
  }

  /**
   * Analyze a single file for egress connections.
   */
  analyzeFile(file, content) {
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      errorRecovery: true,
    });

    // Track variable assignments for context
    const variableContext = new Map();

    traverse.default(ast, {
      // Track variable assignments
      VariableDeclarator: (path) => {
        if (path.node.init && path.node.id.type === 'Identifier') {
          variableContext.set(path.node.id.name, {
            type: this.inferType(path.node.init),
            line: path.node.loc?.start.line,
          });
        }
      },

      // Detect RabbitMQ connections
      CallExpression: (path) => {
        this.detectRabbitMQ(path, file, variableContext);
        this.detectHTTPCalls(path, file, variableContext);
      },

      // Detect string literals that look like URLs
      StringLiteral: (path) => {
        this.detectURLStrings(path, file);
      },

      // Detect template literals with URLs
      TemplateLiteral: (path) => {
        this.detectURLTemplates(path, file);
      },
    });
  }

  /**
   * Detect RabbitMQ operations (publish, send, sendToQueue, etc.)
   */
  detectRabbitMQ(path, file, context) {
    const callee = path.node.callee;
    
    // channel.publish(), channel.sendToQueue(), channel.send()
    if (callee.type === 'MemberExpression') {
      const method = callee.property.name;
      const rabbitMQMethods = ['publish', 'sendToQueue', 'send', 'assertQueue', 'consume', 'assertExchange', 'bindQueue'];
      
      if (rabbitMQMethods.includes(method)) {
        // Extract queue/exchange name from first argument
        const firstArg = path.node.arguments[0];
        let target = '';
        
        if (firstArg) {
          if (firstArg.type === 'StringLiteral') {
            target = firstArg.value || '(empty - auto-generated)';
          } else if (firstArg.type === 'Identifier') {
            target = `variable:${firstArg.name}`;
          } else if (firstArg.type === 'MemberExpression') {
            const objName = firstArg.object.name || firstArg.object.type;
            const propName = firstArg.property.name;
            target = `variable:${objName}.${propName}`;
          }
        } else {
          target = '(no argument)';
        }

        // For assertExchange, get exchange name
        if (method === 'assertExchange' && firstArg && firstArg.type === 'StringLiteral') {
          target = `exchange:${firstArg.value}`;
        }

        this.egress.add(new EgressConnection({
          type: 'rabbitmq',
          target: target,
          method: method,
          file: file,
          line: path.node.loc?.start.line || null,
          context: `channel.${method}()`,
        }));
      }
    }

    // amqplib.connect() - detect connection strings
    if (callee.type === 'MemberExpression' && callee.property.name === 'connect') {
      const firstArg = path.node.arguments[0];
      if (firstArg) {
        let url = null;
        if (firstArg.type === 'StringLiteral') {
          url = firstArg.value;
        } else if (firstArg.type === 'MemberExpression') {
          const objName = firstArg.object.name || firstArg.object.type;
          const propName = firstArg.property.name;
          url = `variable:${objName}.${propName}`;
        } else if (firstArg.type === 'Identifier') {
          url = `variable:${firstArg.name}`;
        }

        if (url && (url.startsWith('amqp://') || url.startsWith('amqps://') || url.includes('variable:'))) {
          this.egress.add(new EgressConnection({
            type: 'rabbitmq',
            target: url,
            method: 'connect',
            file: file,
            line: path.node.loc?.start.line || null,
            context: 'amqplib.connect()',
          }));
        }
      }
    }
  }

  /**
   * Detect HTTP/HTTPS calls (axios, fetch, http.request, etc.)
   */
  detectHTTPCalls(path, file, context) {
    const callee = path.node.callee;

    // axios.get(), axios.post(), etc.
    if (callee.type === 'MemberExpression') {
      const object = callee.object.name;
      const method = callee.property.name;
      
      const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
      
      if ((object === 'axios' || object === 'http' || object === 'https') && 
          httpMethods.includes(method)) {
        const firstArg = path.node.arguments[0];
        if (firstArg) {
          const url = this.extractURL(firstArg);
          if (url) {
            this.egress.add(new EgressConnection({
              type: this.inferProtocol(url),
              target: url,
              method: method.toUpperCase(),
              file: file,
              line: path.node.loc?.start.line || null,
              context: `${object}.${method}()`,
            }));
          }
        }
      }

      // http.request(), https.request()
      if ((object === 'http' || object === 'https') && method === 'request') {
        const firstArg = path.node.arguments[0];
        if (firstArg) {
          const url = this.extractURL(firstArg);
          if (url) {
            this.egress.add(new EgressConnection({
              type: object === 'https' ? 'https' : 'http',
              target: url,
              method: 'REQUEST',
              file: file,
              line: path.node.loc?.start.line || null,
              context: `${object}.request()`,
            }));
          }
        }
      }
    }

    // fetch() calls
    if (callee.type === 'Identifier' && callee.name === 'fetch') {
      const firstArg = path.node.arguments[0];
      if (firstArg) {
        const url = this.extractURL(firstArg);
        if (url) {
          this.egress.add(new EgressConnection({
            type: this.inferProtocol(url),
            target: url,
            method: 'GET', // Default, could be overridden in options
            file: file,
            line: path.node.loc?.start.line || null,
            context: 'fetch()',
          }));
        }
      }
    }

    // axios() direct call
    if (callee.type === 'Identifier' && callee.name === 'axios') {
      const firstArg = path.node.arguments[0];
      if (firstArg) {
        // axios(url) or axios({ url: ... })
        const url = this.extractURL(firstArg);
        if (url) {
          this.egress.add(new EgressConnection({
            type: this.inferProtocol(url),
            target: url,
            method: 'GET',
            file: file,
            line: path.node.loc?.start.line || null,
            context: 'axios()',
          }));
        }
      }
    }
  }

  /**
   * Detect URL strings (for static analysis).
   */
  detectURLStrings(path, file) {
    const value = path.node.value;
    
    // Only detect external URLs (not localhost, not relative paths)
    if (typeof value === 'string' && 
        (value.startsWith('http://') || value.startsWith('https://')) &&
        !value.includes('localhost') &&
        !value.includes('127.0.0.1')) {
      
      // Skip if already detected in a function call
      const parent = path.parent;
      if (parent.type === 'CallExpression') return;

      // Skip if in a config file (these are configuration, not actual calls)
      if (file.includes('config.js') || file.includes('config.ts')) return;

      // Skip if it's a property value in an object (likely config)
      if (parent.type === 'ObjectProperty') return;

      this.egress.add(new EgressConnection({
        type: this.inferProtocol(value),
        target: value,
        method: 'UNKNOWN',
        file: file,
        line: path.node.loc?.start.line || null,
        context: 'string literal',
      }));
    }
  }

  /**
   * Detect URL template literals.
   */
  detectURLTemplates(path, file) {
    const quasi = path.node.quasis[0];
    if (!quasi) return;

    const value = quasi.value.raw;
    if (value.startsWith('http://') || value.startsWith('https://')) {
      // Skip if in function call
      const parent = path.parent;
      if (parent.type === 'CallExpression') return;

      this.egress.add(new EgressConnection({
        type: this.inferProtocol(value),
        target: value,
        method: 'UNKNOWN',
        file: file,
        line: path.node.loc?.start.line || null,
        context: 'template literal',
      }));
    }
  }

  /**
   * Extract URL from AST node.
   */
  extractURL(node) {
    if (node.type === 'StringLiteral') {
      return node.value;
    }
    
    if (node.type === 'TemplateLiteral') {
      // Try to reconstruct URL from template literal
      // For `${baseUrl}/path`, we want to capture the pattern
      let url = '';
      for (let i = 0; i < node.quasis.length; i++) {
        url += node.quasis[i].value.raw;
        if (i < node.expressions.length) {
          const expr = node.expressions[i];
          if (expr.type === 'MemberExpression') {
            // ${this.baseUrl} or ${env.url}
            url += `\${${expr.property.name}}`;
          } else if (expr.type === 'Identifier') {
            url += `\${${expr.name}}`;
          } else {
            url += '${...}';
          }
        }
      }
      // Only return if it looks like a URL
      if (url.includes('http') || url.includes('://')) {
        return url;
      }
    }

    if (node.type === 'MemberExpression') {
      // env.mockEmailApi, this.baseUrl, etc.
      // Return a placeholder indicating it's a variable
      const objName = node.object.name || node.object.type;
      const propName = node.property.name;
      return `variable:${objName}.${propName}`;
    }

    if (node.type === 'Identifier') {
      // Just a variable name
      return `variable:${node.name}`;
    }

    if (node.type === 'ObjectExpression') {
      // axios({ url: '...' })
      for (const prop of node.properties) {
        if (prop.key.name === 'url') {
          return this.extractURL(prop.value);
        }
      }
    }

    return null;
  }

  /**
   * Infer protocol from URL.
   */
  inferProtocol(url) {
    if (url.startsWith('https://')) return 'https';
    if (url.startsWith('http://')) return 'http';
    if (url.startsWith('amqps://')) return 'rabbitmq';
    if (url.startsWith('amqp://')) return 'rabbitmq';
    
    // For variables and template literals, assume HTTP (will be categorized properly)
    if (url.startsWith('variable:') || url.startsWith('${')) {
      return 'http'; // Default to http, can be refined based on context
    }
    
    return 'unknown';
  }

  /**
   * Infer type from AST node.
   */
  inferType(node) {
    if (node.type === 'CallExpression') {
      if (node.callee.name === 'require') {
        const arg = node.arguments[0];
        if (arg && arg.type === 'StringLiteral') {
          return arg.value;
        }
      }
    }
    return 'unknown';
  }

  /**
   * Get egress collection.
   */
  getEgress() {
    return this.egress;
  }
}
