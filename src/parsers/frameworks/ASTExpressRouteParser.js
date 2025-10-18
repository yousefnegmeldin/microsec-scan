import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import { Route, RouteCollection, AuthTypeDetector } from "./RouteAnalyzer.js";

/**
 * AST-based Express.js route parser.
 * Dynamically tracks variable names and extracts routes regardless of naming conventions.
 */
export class ASTExpressRouteParser {
  constructor(serviceDir, findJsFiles, readFile) {
    this.serviceDir = serviceDir;
    this.findJsFiles = findJsFiles;
    this.readFile = readFile;
    this.routes = new RouteCollection();
  }

  /**
   * Parse all routes in the service using AST.
   */
  parse() {
    const files = this.findJsFiles(this.serviceDir);

    for (const file of files) {
      const content = this.readFile(file);
      if (!content) continue;

      try {
        this.parseFileAST(file, content);
      } catch (err) {
        // Skip files with syntax errors (might not be JS/TS)
        if (err.code !== 'BABEL_PARSE_ERROR') {
          console.error(`AST parse error in ${file}:`, err.message);
        }
      }
    }

    return this.routes;
  }

  /**
   * Parse a single file using AST.
   */
  parseFileAST(file, content) {
    // Step 1: Parse code into AST
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      errorRecovery: true,
    });

    // Step 2: Track Express variables
    const expressVars = new Set();  // Variables holding express()
    const routerVars = new Set();   // Variables holding Router()

    traverse.default(ast, {
      // Find: const X = express()
      // Find: const Y = Router()
      // Find: const Z = express.Router()
      VariableDeclarator: (path) => {
        const init = path.node.init;
        if (!init) return;

        // Pattern: express()
        if (init.type === 'CallExpression' && init.callee.name === 'express') {
          expressVars.add(path.node.id.name);
        }

        // Pattern: Router()
        if (init.type === 'CallExpression' && init.callee.name === 'Router') {
          routerVars.add(path.node.id.name);
        }

        // Pattern: express.Router()
        if (
          init.type === 'CallExpression' &&
          init.callee.type === 'MemberExpression' &&
          init.callee.object.name === 'express' &&
          init.callee.property.name === 'Router'
        ) {
          routerVars.add(path.node.id.name);
        }
      },
    });

    // Step 3: Extract routes using tracked variables
    const allTrackedVars = new Set([...expressVars, ...routerVars]);

    traverse.default(ast, {
      // Find: X.get('/path', middleware, handler)
      CallExpression: (path) => {
        const callee = path.node.callee;
        
        // Must be a member expression (X.method)
        if (callee.type !== 'MemberExpression') return;

        const objectName = callee.object.name;
        const method = callee.property.name;

        // Check if it's a tracked Express/Router variable
        if (!allTrackedVars.has(objectName)) return;

        // Check if it's a route method
        const routeMethods = ['get', 'post', 'put', 'delete', 'patch', 'all', 'use'];
        if (!routeMethods.includes(method)) return;

        // Extract route path
        const firstArg = path.node.arguments[0];
        if (!firstArg || firstArg.type !== 'StringLiteral') return;

        const routePath = firstArg.value;

        // Skip if mounting a router (app.use('/api', router))
        if (method === 'use' && path.node.arguments.length > 1) {
          const secondArg = path.node.arguments[1];
          if (secondArg.type === 'Identifier' && allTrackedVars.has(secondArg.name)) {
            return; // This is mounting a router, not a route
          }
        }

        // Extract middleware
        const middleware = this.extractMiddlewareFromAST(path.node.arguments.slice(1));

        // Analyze authentication
        const { authenticated, authType } = this.analyzeAuthentication(middleware, content);
        const isPublic = RouteCollection.isLikelyPublicRoute(routePath);

        // Get line number
        const lineNum = path.node.loc ? path.node.loc.start.line : null;

        this.routes.add(new Route({
          method: method.toUpperCase(),
          path: routePath,
          authenticated,
          authType,
          middleware,
          file,
          line: lineNum,
          isPublic,
        }));
      },
    });
  }

  /**
   * Extract middleware names from AST arguments.
   */
  extractMiddlewareFromAST(args) {
    const middleware = [];

    for (const arg of args) {
      if (arg.type === 'Identifier') {
        // Simple identifier: authenticate
        middleware.push(arg.name);
      } else if (arg.type === 'MemberExpression') {
        // Member expression: auth.verify
        const obj = arg.object.name || '';
        const prop = arg.property.name || '';
        middleware.push(`${obj}.${prop}`);
      } else if (arg.type === 'CallExpression') {
        // Function call: passport.authenticate('jwt')
        if (arg.callee.type === 'Identifier') {
          middleware.push(arg.callee.name);
        } else if (arg.callee.type === 'MemberExpression') {
          const obj = arg.callee.object.name || '';
          const prop = arg.callee.property.name || '';
          middleware.push(`${obj}.${prop}`);
        }
      } else if (arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression') {
        // Inline function
        middleware.push('anonymous');
      }
    }

    return middleware;
  }

  /**
   * Analyze if a route is authenticated based on middleware.
   */
  analyzeAuthentication(middleware, fileContent) {
    if (!middleware || middleware.length === 0) {
      return { authenticated: false, authType: null };
    }

    // Common authentication middleware patterns
    const authPatterns = [
      'authenticate',
      'auth',
      'requireAuth',
      'isAuthenticated',
      'verifyToken',
      'validateToken',
      'checkToken',
      'ensureAuthenticated',
      'protect',
      'passport',
      'jwt',
      'bearer',
      'authorize',
      'checkAuth',
      'verifyBearer',
      'requireRoles',
      'requireClientIds',
    ];

    const hasAuth = middleware.some(mw => 
      authPatterns.some(pattern => 
        mw.toLowerCase().includes(pattern.toLowerCase())
      )
    );

    if (hasAuth) {
      const authType = AuthTypeDetector.detect(middleware, fileContent);
      return { authenticated: true, authType };
    }

    return { authenticated: false, authType: null };
  }

  /**
   * Get the parsed routes.
   */
  getRoutes() {
    return this.routes;
  }
}
