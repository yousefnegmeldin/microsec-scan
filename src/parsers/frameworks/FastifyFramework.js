import { BaseFramework } from "./BaseFramework.js";
import { createFinding } from "../../rules/registry.js";
import { ASTFastifyRouteParser } from "./ASTFastifyRouteParser.js";
import { RouteCollection } from "./RouteAnalyzer.js";
import {
  checkHelmetAST,
  checkCORSAST,
  checkRateLimitingAST,
  checkBodySizeLimitAST,
  checkExposedEndpointsAST,
} from "./ASTFrameworkChecker.js";

/**
 * Fastify framework analyzer.
 */
export class FastifyFramework extends BaseFramework {
  constructor(serviceDir) {
    super(serviceDir);
    this.routes = null;
  }

  detect() {
    return this.hasPackage("fastify");
  }

  getName() {
    return "Fastify";
  }

  analyze(verbose = false, showRoutes = false) {
    const findings = [];

    // Parse routes using AST
    const parser = new ASTFastifyRouteParser(
      this.serviceDir,
      this.findJsFiles.bind(this),
      this.readFile.bind(this)
    );
    this.routes = parser.parse();

    findings.push(...this.checkHelmet());
    findings.push(...this.checkRateLimiting());
    findings.push(...this.checkCORS());
    findings.push(...this.checkRouteAuthentication());
    findings.push(...this.checkBodySizeLimits());
    findings.push(...this.checkExposedEndpoints());

    if (verbose) {
      console.log(`    Fastify checks: ${findings.length} issues found`);
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

  checkRouteAuthentication() {
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
            `Sensitive route ${route.method} ${route.path} lacks authentication`
          )
        );
      }
    }

    // If NO routes have auth at all, flag it
    const authenticated = this.routes.getAuthenticated();
    if (authenticated.length === 0 && this.routes.getAll().length > 0) {
      findings.push(
        createFinding("FASTIFY_MISSING_AUTH", this.serviceDir, undefined)
      );
    }

    return findings;
  }

  checkBodySizeLimits() {
    const findings = [];
    const files = this.findJsFiles(this.serviceDir);
    let hasBodyLimit = false;

    for (const file of files) {
      const content = this.readFile(file);
      if (!content) continue;
      if (checkBodySizeLimitAST(file, content)) {
        hasBodyLimit = true;
        break;
      }
    }

    if (!hasBodyLimit) {
      findings.push(
        createFinding(
          "MISSING_BODY_SIZE_LIMIT",
          this.serviceDir,
          undefined,
          "Body parser missing size limit (vulnerable to large payload attacks)"
        )
      );
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
