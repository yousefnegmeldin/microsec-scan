import chalk from 'chalk';
import { ExpressFramework } from "./frameworks/ExpressFramework.js";
import { FastifyFramework } from "./frameworks/FastifyFramework.js";
import { NestJSFramework } from "./frameworks/NestJSFramework.js";
import { RouteReporter } from "../reporters/routeReporter.js";
import { EgressReporter } from "../egress/EgressReporter.js";

/**
 * Analyzes a microservice directory for security issues.
 * Automatically detects the framework and runs appropriate checks.
 */
export function analyzeMicroservice(serviceDir, verbose = false, showRoutes = false, showEgress = false) {
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
      console.log(chalk.gray(`   ℹ️  No supported framework detected`));
    }
    return findings;
  }

  // Run analysis for each detected framework
  for (const framework of detectedFrameworks) {
    if (verbose) {
      console.log(chalk.gray(`   Framework: ${framework.getName()}`));
    }

    const frameworkFindings = framework.analyze(false, showRoutes); // Don't pass verbose to framework
    findings.push(...frameworkFindings);

    // Display route analysis if requested and available
    if (showRoutes && framework.getRoutes) {
      const routes = framework.getRoutes();
      if (routes) {
        RouteReporter.printRouteTable(serviceDir, routes);
        RouteReporter.printRouteSummary(serviceDir, routes, frameworkFindings);
      }
    }

    // Display egress analysis if requested and available
    if (showEgress && framework.getEgress) {
      const egress = framework.getEgress();
      if (egress && egress.getAll().length > 0) {
        EgressReporter.printEgressTable(serviceDir, egress);
        EgressReporter.printEgressSummary(egress);
        EgressReporter.printEgressWarnings(egress);
      }
    }
  }

  return findings;
}
