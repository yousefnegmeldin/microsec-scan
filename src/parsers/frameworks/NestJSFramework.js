import { BaseFramework } from "./BaseFramework.js";
import { createFinding } from "../../rules/registry.js";
import { ASTNestJSRouteParser } from "./ASTNestJSRouteParser.js";
import { RouteCollection } from "./RouteAnalyzer.js";
import {
  checkHelmetAST,
  checkCORSAST,
  checkRateLimitingAST,
  checkValidationPipeAST,
  checkExposedEndpointsAST,
} from "./ASTFrameworkChecker.js";

/**
 * NestJS framework analyzer.
 */
export class NestJSFramework extends BaseFramework {
  constructor(serviceDir) {
    super(serviceDir);
    this.routes = null;
  }

  detect() {
    return this.hasPackage("@nestjs/core") || this.hasPackage("@nestjs/common");
  }

  getName() {
    return "NestJS";
  }

  analyze(verbose = false, showRoutes = false) {
    const findings = [];

    // Parse routes using AST
    const parser = new ASTNestJSRouteParser(
      this.serviceDir,
      this.findJsFiles.bind(this),
      this.readFile.bind(this)
    );
    this.routes = parser.parse();

    findings.push(...this.checkHelmet());
    findings.push(...this.checkRateLimiting());
    findings.push(...this.checkCORS());
    findings.push(...this.checkRouteGuards());
    findings.push(...this.checkValidationPipe());
    findings.push(...this.checkExposedEndpoints());

    if (verbose) {
      console.log(`    NestJS checks: ${findings.length} issues found`);
      if (this.routes) {
        console.log(`    Routes detected: ${this.routes.getAll().length}`);
      }
    }

    return findings;
  }

  getRoutes() {
    return this.routes;
  }

  checkHelmet() {
    const findings = [];
    const files = this.findJsFiles(this.serviceDir);
    let hasHelmet = false;

    for (const file of files) {
      const content = this.readFile(file);
      if (!content) continue;
      if (checkHelmetAST(file, content)) {
        hasHelmet = true;
        break;
      }
    }

    if (!hasHelmet) {
      findings.push(createFinding("MISSING_HELMET", this.serviceDir, undefined, "App missing helmet middleware for security headers"));
    }
    return findings;
  }

  checkRateLimiting() {
    const findings = [];
    const files = this.findJsFiles(this.serviceDir);
    let hasRateLimit = false;

    for (const file of files) {
      const content = this.readFile(file);
      if (!content) continue;
      if (checkRateLimitingAST(file, content)) {
        hasRateLimit = true;
        break;
      }
    }

    if (!hasRateLimit) {
      findings.push(createFinding("MISSING_RATE_LIMITING", this.serviceDir, undefined, "App missing rate limiting middleware"));
    }
    return findings;
  }

  checkCORS() {
    const findings = [];
    const files = this.findJsFiles(this.serviceDir);

    for (const file of files) {
      const content = this.readFile(file);
      if (!content) continue;
      findings.push(...checkCORSAST(file, content));
    }

    return findings;
  }

  checkRouteGuards() {
    const findings = [];

    if (!this.routes) {
      return findings;
    }

    const unauthenticated = this.routes.getUnauthenticated();

    // Flag unprotected sensitive routes
    for (const route of unauthenticated) {
      if (RouteCollection.isLikelySensitiveRoute(route.path)) {
        findings.push(
          createFinding(
            "UNPROTECTED_ROUTE",
            route.file,
            route.line,
            `Sensitive route ${route.method} ${route.path} lacks guards`
          )
        );
      }
    }

    // If NO routes have guards at all, flag it
    const authenticated = this.routes.getAuthenticated();
    if (authenticated.length === 0 && this.routes.getAll().length > 0) {
      findings.push(
        createFinding("NESTJS_MISSING_GUARDS", this.serviceDir, undefined)
      );
    }

    return findings;
  }

  checkValidationPipe() {
    const findings = [];
    const files = this.findJsFiles(this.serviceDir);
    let hasValidationPipe = false;

    for (const file of files) {
      const content = this.readFile(file);
      if (!content) continue;
      if (checkValidationPipeAST(file, content)) {
        hasValidationPipe = true;
        break;
      }
    }

    if (!hasValidationPipe) {
      findings.push(createFinding("NESTJS_MISSING_VALIDATION_PIPE", this.serviceDir, undefined));
    }

    return findings;
  }

  checkExposedEndpoints() {
    const findings = [];
    const files = this.findJsFiles(this.serviceDir);

    for (const file of files) {
      const content = this.readFile(file);
      if (!content) continue;
      findings.push(...checkExposedEndpointsAST(file, content));
    }

    return findings;
  }
}
