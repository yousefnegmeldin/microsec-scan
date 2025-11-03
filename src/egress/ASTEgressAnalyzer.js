import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import { EgressConnection, EgressCollection } from "./EgressModels.js";
import { createFinding } from "../rules/registry.js";

/**
 * AST-based egress/output analyzer.
 * Detects all outbound connections: RabbitMQ, HTTP/HTTPS, etc.
 * Also performs inter-service security checks.
 */
export class ASTEgressAnalyzer {
  constructor(serviceDir, findJsFiles, readFile) {
    this.serviceDir = serviceDir;
    this.findJsFiles = findJsFiles;
    this.readFile = readFile;
    this.egress = new EgressCollection();
    this.findings = [];
    this.axiosInstances = new Map(); // Track configured axios instances
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
      
      // Only flag if it's likely a RabbitMQ channel (not Express res, WebSocket, etc.)
      const objectName = callee.object.name;
      const isLikelyRabbitMQ = objectName && (
        objectName.includes('channel') || 
        objectName.includes('queue') || 
        objectName.includes('rabbit') ||
        objectName.includes('amqp')
      );
      
      // For 'send' method, be extra strict since it's common in Express/WebSocket
      const isSendMethod = method === 'send';
      const shouldCheck = isSendMethod ? isLikelyRabbitMQ : rabbitMQMethods.includes(method);
      
      if (shouldCheck && rabbitMQMethods.includes(method)) {
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

        // Check for message validation on publish operations
        if (['publish', 'sendToQueue', 'send'].includes(method)) {
          if (!this.hasMessageValidation(path, file)) {
            this.findings.push(createFinding(
              'MISSING_MESSAGE_VALIDATION',
              file,
              path.node.loc?.start.line || null,
              `RabbitMQ ${method}() without schema validation (consider JSON Schema, Avro, or Protobuf)`
            ));
          }
        }
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

            // Inter-service security checks
            if (this.isInternalService(url)) {
              // Check for missing authentication (only on direct axios, not custom instances)
              if (object === 'axios' && !this.hasAuthHeader(path)) {
                this.findings.push(createFinding(
                  'MISSING_SERVICE_AUTH',
                  file,
                  path.node.loc?.start.line || null,
                  `Service-to-service call to ${url} without authentication header`
                ));
              }

              // Check for missing mTLS on HTTPS calls or internal service calls
              // For template literals/variables, we can't know the protocol, but internal services should use mTLS
              const isHttps = url.startsWith('https://') || url.includes('HTTPS') || url.includes('https');
              const isTemplateOrVar = url.includes('${') || url.startsWith('variable:');
              
              if ((isHttps || isTemplateOrVar) && !this.hasMutualTLS(path)) {
                this.findings.push(createFinding(
                  'MISSING_MUTUAL_TLS',
                  file,
                  path.node.loc?.start.line || null,
                  `Internal service call to ${url} without mutual TLS configuration`
                ));
              }

              // Check for missing circuit breaker
              if (!this.hasCircuitBreaker(path)) {
                this.findings.push(createFinding(
                  'MISSING_CIRCUIT_BREAKER',
                  file,
                  path.node.loc?.start.line || null,
                  `Service-to-service call to ${url} without circuit breaker pattern`
                ));
              }
            }
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

          // Inter-service security checks for fetch
          if (this.isInternalService(url)) {
            if (!this.hasAuthHeader(path)) {
              this.findings.push(createFinding(
                'MISSING_SERVICE_AUTH',
                file,
                path.node.loc?.start.line || null,
                `Service-to-service fetch() to ${url} without authentication header`
              ));
            }

            const isHttps = url.startsWith('https://') || url.includes('HTTPS') || url.includes('https');
            const isTemplateOrVar = url.includes('${') || url.startsWith('variable:');
            
            if ((isHttps || isTemplateOrVar) && !this.hasMutualTLS(path)) {
              this.findings.push(createFinding(
                'MISSING_MUTUAL_TLS',
                file,
                path.node.loc?.start.line || null,
                `Internal service call to ${url} without mutual TLS configuration`
              ));
            }

            if (!this.hasCircuitBreaker(path)) {
              this.findings.push(createFinding(
                'MISSING_CIRCUIT_BREAKER',
                file,
                path.node.loc?.start.line || null,
                `Service-to-service fetch() to ${url} without circuit breaker pattern`
              ));
            }
          }
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
      // Return if it has a variable or looks like a path
      // Template literals in axios/fetch calls are usually URLs
      if (url.includes('${') || url.includes('/') || url.includes('http') || url.includes('://')) {
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

  /**
   * Get security findings from inter-service checks.
   */
  getFindings() {
    return this.findings;
  }

  /**
   * Check if URL is an internal service (not external API).
   */
  isInternalService(url) {
    if (!url || typeof url !== 'string') return false;
    
    // Skip external APIs (have TLDs like .com, .io, .net)
    if (/\.(com|io|net|org|dev|app|co)\b/i.test(url)) {
      return false;
    }
    
    // Internal services typically have:
    // - Port numbers (e.g., :3000, :8080)
    // - Service names without TLD (e.g., payment-service, user-service, auth:3001)
    // - Internal IPs (10.x, 192.168.x, 172.x)
    // - Template literals with variables (${AUTH_URL}, ${baseUrl})
    const internalPatterns = [
      /:\d{4,5}(?:\/|$)/, // Has port number
      /^https?:\/\/[a-z-]+(?::\d+)?(?:\/|$)/i, // Service name (no dots)
      /^https?:\/\/(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/,  // Private IPs
      /\$\{[^}]+\}/, // Template literal variables
      /^variable:/, // Variable references
    ];
    
    return internalPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Check if axios/fetch call has authentication header.
   */
  hasAuthHeader(path) {
    const args = path.node.arguments;
    
    // Check second argument (config object) for axios.get/post/etc
    // axios.get(url, { headers: { Authorization: ... } })
    const configArg = args[1];
    if (configArg && configArg.type === 'ObjectExpression') {
      for (const prop of configArg.properties) {
        if (prop.key && (prop.key.name === 'headers' || prop.key.value === 'headers')) {
          if (prop.value.type === 'ObjectExpression') {
            const hasAuth = prop.value.properties.some(p => 
              p.key && (p.key.name === 'Authorization' || p.key.value === 'Authorization' ||
                       p.key.name === 'authorization' || p.key.value === 'authorization')
            );
            if (hasAuth) return true;
          }
        }
      }
    }
    
    // Check third argument for fetch
    // fetch(url, { headers: { Authorization: ... } })
    const fetchConfig = args[1];
    if (fetchConfig && fetchConfig.type === 'ObjectExpression') {
      for (const prop of fetchConfig.properties) {
        if (prop.key && (prop.key.name === 'headers' || prop.key.value === 'headers')) {
          if (prop.value.type === 'ObjectExpression') {
            const hasAuth = prop.value.properties.some(p =>
              p.key && (p.key.name === 'Authorization' || p.key.value === 'Authorization')
            );
            if (hasAuth) return true;
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Check if call is on a custom axios instance (not direct axios).
   */
  isCustomAxiosInstance(callee) {
    if (callee.type !== 'MemberExpression') return false;
    
    const objectName = callee.object.name;
    
    // Direct axios calls: axios.get(), axios.post()
    if (objectName === 'axios') return false;
    
    // Custom instance: apiClient.get(), httpClient.post()
    // Assume these are pre-configured
    return true;
  }

  /**
   * Check if HTTPS call has mTLS configuration.
   */
  hasMutualTLS(path) {
    const args = path.node.arguments;
    
    // Check for httpsAgent in config
    const configArg = args[1] || args[2]; // Could be 2nd or 3rd arg
    if (configArg && configArg.type === 'ObjectExpression') {
      for (const prop of configArg.properties) {
        if (prop.key && (prop.key.name === 'httpsAgent' || prop.key.value === 'httpsAgent')) {
          return true; // Has httpsAgent configured
        }
      }
    }
    
    return false;
  }

  /**
   * Check if call is wrapped in circuit breaker.
   */
  hasCircuitBreaker(path) {
    // Walk up the AST to see if we're inside a circuit breaker
    let current = path.parentPath;
    let depth = 0;
    
    while (current && depth < 5) {
      const node = current.node;
      
      // Check for circuit breaker patterns
      if (node.type === 'CallExpression' && node.callee) {
        const calleeName = node.callee.name || 
                          (node.callee.property && node.callee.property.name);
        
        // Common circuit breaker libraries: opossum, hystrixjs, brakes
        if (calleeName && /circuit|breaker|hystrix|brakes/i.test(calleeName)) {
          return true;
        }
      }
      
      current = current.parentPath;
      depth++;
    }
    
    return false;
  }

  /**
   * Check if message has schema validation before publish.
   */
  hasMessageValidation(path, file) {
    // Look backwards in the same function scope for validation calls
    let current = path.parentPath;
    
    // Find the containing function
    while (current && current.node.type !== 'FunctionDeclaration' && 
           current.node.type !== 'FunctionExpression' && 
           current.node.type !== 'ArrowFunctionExpression') {
      current = current.parentPath;
    }
    
    if (!current) return false;
    
    // Check if function body contains validation library calls
    let hasValidation = false;
    
    current.traverse({
      CallExpression(validationPath) {
        const callee = validationPath.node.callee;
        
        // Check for common validation libraries
        // ajv: ajv.validate(), validate()
        // joi: joi.validate(), schema.validate()
        // yup: schema.validate()
        // class-validator: validate()
        if (callee.type === 'MemberExpression') {
          const method = callee.property && callee.property.name;
          const object = callee.object && callee.object.name;
          
          if (method === 'validate' || method === 'validateSync') {
            hasValidation = true;
          }
          
          if (object === 'ajv' || object === 'joi' || object === 'yup') {
            hasValidation = true;
          }
        }
        
        if (callee.type === 'Identifier' && callee.name === 'validate') {
          hasValidation = true;
        }
      }
    });
    
    return hasValidation;
  }
}
