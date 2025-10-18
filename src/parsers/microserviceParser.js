import { ExpressFramework } from "./frameworks/ExpressFramework.js";
import { FastifyFramework } from "./frameworks/FastifyFramework.js";
import { NestJSFramework } from "./frameworks/NestJSFramework.js";
import { RouteReporter } from "../reporters/routeReporter.js";

/**
 * Analyzes a microservice directory for security issues.
 * Automatically detects the framework and runs appropriate checks.
 */
export function analyzeMicroservice(serviceDir, verbose = false, showRoutes = false) {
  const findings = [];

  // Initialize all framework analyzers
  const frameworks = [
    new ExpressFramework(serviceDir),
    new FastifyFramework(serviceDir),
    new NestJSFramework(serviceDir),
  ];

  // Detect which framework(s) are used
  const detectedFrameworks = frameworks.filter((fw) => fw.detect());

  if (detectedFrameworks.length === 0) {
    if (verbose) {
      console.log(`    No supported framework detected`);
    }
    return findings;
  }

  // Run analysis for each detected framework
  for (const framework of detectedFrameworks) {
    if (verbose) {
      console.log(`    ${framework.getName()} detected`);
    }

    const frameworkFindings = framework.analyze(verbose, showRoutes);
    findings.push(...frameworkFindings);

    // Display route analysis if requested and available
    if (showRoutes && framework.getRoutes) {
      const routes = framework.getRoutes();
      if (routes) {
        RouteReporter.printRouteTable(serviceDir, routes);
        RouteReporter.printRouteSummary(serviceDir, routes, frameworkFindings);
      }
    }
  }

  return findings;
}
