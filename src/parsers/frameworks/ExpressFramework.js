import { BaseFramework } from "./BaseFramework.js";
import { createFinding } from "../../rules/registry.js";
import { ASTExpressRouteParser } from "./ASTExpressRouteParser.js";
import { RouteCollection } from "./RouteAnalyzer.js";
import {
  checkHelmetAST,
  checkCORSAST,
  checkRateLimitingAST,
  checkBodySizeLimitAST,
  checkExposedEndpointsAST,
} from "./ASTFrameworkChecker.js";
import { ASTEgressAnalyzer } from "../../egress/ASTEgressAnalyzer.js";

/**
 * Express.js framework analyzer.
 */
export class ExpressFramework extends BaseFramework {
  constructor(serviceDir) {
    super(serviceDir);
    this.routes = null; // Will be populated during analysis
    this.egress = null; // Will be populated during analysis
  }

  detect() {
    return this.hasPackage("express");
  }

  getName() {
    return "Express";
  }

  analyze(verbose = false, showRoutes = false) {
    const findings = [];

    // Parse routes using AST (dynamic variable tracking!)
    const parser = new ASTExpressRouteParser(
      this.serviceDir,
      this.findJsFiles.bind(this),
      this.readFile.bind(this)
    );
    this.routes = parser.parse();

    // Analyze egress/output connections
    const egressAnalyzer = new ASTEgressAnalyzer(
      this.serviceDir,
      this.findJsFiles.bind(this),
      this.readFile.bind(this)
    );
    this.egress = egressAnalyzer.analyze();
    
    // Add inter-service security findings from egress analyzer
    findings.push(...egressAnalyzer.getFindings());

    // Run traditional checks
    findings.push(...this.checkHelmet());
    findings.push(...this.checkRateLimiting());
    findings.push(...this.checkCORS());
    findings.push(...this.checkBodySizeLimits());
    findings.push(...this.checkExposedEndpoints());

    // Run route-level authentication checks
    findings.push(...this.checkRouteAuthentication());

    return findings;
  }

  /**
   * Get parsed routes (for reporting).
   */
  getRoutes() {
    return this.routes;
  }

  /**
   * Get egress connections (for reporting).
   */
  getEgress() {
    return this.egress;
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

  /**
   * Check route-level authentication.
   * Flags unprotected sensitive routes.
   */
  checkRouteAuthentication() {
    const findings = [];

    if (!this.routes) {
      return findings;
    }

    const unauthenticated = this.routes.getUnauthenticated();

    for (const route of unauthenticated) {
      // Check if this is a sensitive route that should be protected
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

    // If NO routes have authentication at all, flag it
    const authenticated = this.routes.getAuthenticated();
    if (authenticated.length === 0 && this.routes.getAll().length > 0) {
      findings.push(
        createFinding("MISSING_AUTHENTICATION", this.serviceDir, undefined)
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
