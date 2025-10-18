import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import { Route, RouteCollection, AuthTypeDetector } from "./RouteAnalyzer.js";

/**
 * AST-based Fastify route parser.
 * Dynamically tracks Fastify instances and extracts routes.
 */
export class ASTFastifyRouteParser {
  constructor(serviceDir, findJsFiles, readFile) {
    this.serviceDir = serviceDir;
    this.findJsFiles = findJsFiles;
    this.readFile = readFile;
    this.routes = new RouteCollection();
  }

  parse() {
    const files = this.findJsFiles(this.serviceDir);

    for (const file of files) {
      const content = this.readFile(file);
      if (!content) continue;

      try {
        this.parseFileAST(file, content);
      } catch (err) {
        if (err.code !== 'BABEL_PARSE_ERROR') {
          console.error(`AST parse error in ${file}:`, err.message);
        }
      }
    }

    return this.routes;
  }

  parseFileAST(file, content) {
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      errorRecovery: true,
    });

    // Track Fastify instances
    const fastifyVars = new Set();

    traverse.default(ast, {
      // Find: const app = fastify()
      VariableDeclarator: (path) => {
        const init = path.node.init;
        if (!init) return;

        if (init.type === 'CallExpression' && init.callee.name === 'fastify') {
          fastifyVars.add(path.node.id.name);
        }
      },
    });

    // Extract routes
    traverse.default(ast, {
      CallExpression: (path) => {
        const callee = path.node.callee;
        
        if (callee.type !== 'MemberExpression') return;

        const objectName = callee.object.name;
        const method = callee.property.name;

        if (!fastifyVars.has(objectName)) return;

        const routeMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'all', 'route'];
        if (!routeMethods.includes(method)) return;

        // Extract route path
        const firstArg = path.node.arguments[0];
        if (!firstArg || firstArg.type !== 'StringLiteral') return;

        const routePath = firstArg.value;

        // Extract hooks/middleware
        const middleware = this.extractMiddlewareFromAST(path.node.arguments.slice(1));
        const { authenticated, authType } = this.analyzeAuthentication(middleware, content);
        const isPublic = RouteCollection.isLikelyPublicRoute(routePath);

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

  extractMiddlewareFromAST(args) {
    const middleware = [];

    for (const arg of args) {
      if (arg.type === 'Identifier') {
        middleware.push(arg.name);
      } else if (arg.type === 'ObjectExpression') {
        // Check for hooks in options object
        for (const prop of arg.properties) {
          if (prop.key.name === 'preHandler' || prop.key.name === 'onRequest') {
            if (prop.value.type === 'Identifier') {
              middleware.push(prop.value.name);
            }
          }
        }
      }
    }

    return middleware;
  }

  analyzeAuthentication(middleware, fileContent) {
    if (!middleware || middleware.length === 0) {
      return { authenticated: false, authType: null };
    }

    const authPatterns = [
      'authenticate',
      'auth',
      'verifyToken',
      'jwt',
      'bearer',
      'fastify-auth',
      'fastify-jwt',
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

  getRoutes() {
    return this.routes;
  }
}
