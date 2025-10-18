import chalk from "chalk";

/**
 * Formats and displays route analysis results.
 */
export class RouteReporter {
  /**
   * Print route table for a service.
   */
  static printRouteTable(serviceDir, routes) {
    if (!routes || routes.getAll().length === 0) {
      console.log(chalk.gray(`\n  No routes detected in ${serviceDir}`));
      return;
    }

    const allRoutes = routes.getAll();
    const stats = routes.getStats();

    console.log(chalk.bold.cyan(`\n📍 Route Analysis: ${serviceDir}`));
    console.log(chalk.gray(`   Total routes: ${stats.total} | Authenticated: ${stats.authenticated} | Public: ${stats.public} | Unprotected: ${stats.unauthenticated}`));
    
    // Print table header
    console.log();
    console.log(chalk.bold('   Route'.padEnd(50)) + chalk.bold('Authenticated'.padEnd(18)) + chalk.bold('Type'));
    console.log(chalk.gray('   ' + '─'.repeat(85)));

    // Sort routes by path for better readability
    const sortedRoutes = allRoutes.sort((a, b) => {
      if (a.path === b.path) {
        return a.method.localeCompare(b.method);
      }
      return a.path.localeCompare(b.path);
    });

    // Print each route
    for (const route of sortedRoutes) {
      this.printRoute(route);
    }

    console.log();
  }

  /**
   * Print a single route row.
   */
  static printRoute(route) {
    const maxRouteWidth = 48; // Maximum width for route column
    let routeStr = `${route.method.padEnd(6)} ${route.path}`;
    
    // Truncate if too long
    if (routeStr.length > maxRouteWidth) {
      routeStr = routeStr.substring(0, maxRouteWidth - 3) + '...';
    }
    
    const authStatus = route.getAuthStatus();
    const authType = route.getAuthTypeDisplay();

    // Color coding
    let routeColor = chalk.white;
    let authColor = chalk.white;

    if (route.isPublic) {
      routeColor = chalk.gray;
      authColor = chalk.gray;
    } else if (route.authenticated) {
      routeColor = chalk.green;
      authColor = chalk.green;
    } else {
      routeColor = chalk.yellow;
      authColor = chalk.red;
    }

    console.log(
      '   ' +
      routeColor(routeStr.padEnd(48)) +
      authColor(authStatus.padEnd(16)) +
      authColor(authType)
    );
  }

  /**
   * Print route security summary.
   */
  static printRouteSummary(serviceDir, routes, findings) {
    if (!routes || routes.getAll().length === 0) {
      return;
    }

    const unauthenticated = routes.getUnauthenticated();
    const publicRoutes = routes.getPublic();

    console.log(chalk.bold.cyan(`\n🔍 Route Security Summary:`));

    // Public routes (OK)
    if (publicRoutes.length > 0) {
      console.log(chalk.green(`   ✅ Public routes (${publicRoutes.length}):`));
      for (const route of publicRoutes.slice(0, 5)) {
        console.log(chalk.gray(`      ${route.toString()}`));
      }
      if (publicRoutes.length > 5) {
        console.log(chalk.gray(`      ... and ${publicRoutes.length - 5} more`));
      }
    }

    // Unprotected routes (WARNING)
    if (unauthenticated.length > 0) {
      console.log(chalk.red(`   ⚠️  Unprotected routes (${unauthenticated.length}):`));
      for (const route of unauthenticated) {
        const isSensitive = this.isSensitiveRoute(route);
        const marker = isSensitive ? chalk.red('❌') : chalk.yellow('⚠️ ');
        console.log(`      ${marker} ${route.toString()}`);
      }
    } else {
      console.log(chalk.green(`   ✅ All non-public routes are protected`));
    }

    console.log();
  }

  /**
   * Check if a route is sensitive and should be protected.
   */
  static isSensitiveRoute(route) {
    const sensitivePatterns = [
      /\/admin/i,
      /\/dashboard/i,
      /\/profile/i,
      /\/account/i,
      /\/settings/i,
      /\/delete/i,
      /\/update/i,
      /\/edit/i,
      /\/create/i,
      /\/payment/i,
      /\/order/i,
    ];

    return sensitivePatterns.some(pattern => pattern.test(route.path));
  }
}
