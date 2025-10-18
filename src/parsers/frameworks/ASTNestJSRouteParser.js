import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import { Route, RouteCollection, AuthTypeDetector } from "./RouteAnalyzer.js";

/**
 * AST-based NestJS route parser.
 * Detects @Controller, @Get, @Post, etc. decorators and extracts routes.
 */
export class ASTNestJSRouteParser {
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
        // Skip files with syntax errors
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
      plugins: ['typescript', 'decorators-legacy'],
      errorRecovery: true,
    });

    let controllerPath = '';

    traverse.default(ast, {
      // Find @Controller decorator to get base path
      ClassDeclaration: (path) => {
        const decorators = path.node.decorators || [];
        
        for (const decorator of decorators) {
          if (this.isControllerDecorator(decorator)) {
            controllerPath = this.extractDecoratorPath(decorator);
          }
        }
      },

      // Find route decorators (@Get, @Post, etc.)
      ClassMethod: (path) => {
        const decorators = path.node.decorators || [];
        
        for (const decorator of decorators) {
          const routeInfo = this.extractRouteFromDecorator(decorator);
          
          if (routeInfo) {
            const fullPath = this.combinePaths(controllerPath, routeInfo.path);
            const guards = this.extractGuards(decorators);
            const authenticated = guards.length > 0;
            const authType = authenticated ? AuthTypeDetector.detect(guards, content) : null;
            const isPublic = RouteCollection.isLikelyPublicRoute(fullPath);

            this.routes.add(new Route({
              method: routeInfo.method,
              path: fullPath,
              authenticated,
              authType,
              middleware: guards,
              file,
              line: path.node.loc?.start.line || null,
              isPublic,
            }));
          }
        }
      },
    });
  }

  isControllerDecorator(decorator) {
    const callee = decorator.expression.callee || decorator.expression;
    return callee.name === 'Controller';
  }

  extractDecoratorPath(decorator) {
    const args = decorator.expression.arguments || [];
    if (args.length > 0 && args[0].type === 'StringLiteral') {
      return args[0].value;
    }
    return '';
  }

  extractRouteFromDecorator(decorator) {
    const callee = decorator.expression.callee || decorator.expression;
    const methods = ['Get', 'Post', 'Put', 'Delete', 'Patch', 'Options', 'Head', 'All'];
    
    if (!methods.includes(callee.name)) return null;

    const args = decorator.expression.arguments || [];
    const path = args.length > 0 && args[0].type === 'StringLiteral' ? args[0].value : '';

    return {
      method: callee.name.toUpperCase(),
      path,
    };
  }

  extractGuards(decorators) {
    const guards = [];

    for (const decorator of decorators) {
      const callee = decorator.expression.callee || decorator.expression;
      
      if (callee.name === 'UseGuards') {
        const args = decorator.expression.arguments || [];
        for (const arg of args) {
          if (arg.type === 'Identifier') {
            guards.push(arg.name);
          } else if (arg.type === 'CallExpression' && arg.callee.name) {
            guards.push(arg.callee.name);
          }
        }
      }
    }

    return guards;
  }

  combinePaths(base, route) {
    if (!base) return route || '/';
    if (!route) return base;
    
    const cleanBase = base.startsWith('/') ? base : `/${base}`;
    const cleanRoute = route.startsWith('/') ? route : `/${route}`;
    
    return `${cleanBase}${cleanRoute}`.replace(/\/+/g, '/');
  }

  getRoutes() {
    return this.routes;
  }
}
