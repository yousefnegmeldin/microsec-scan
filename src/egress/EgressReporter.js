import chalk from "chalk";

/**
 * Egress/Output reporter.
 * Displays outbound connections in a readable format.
 */
export class EgressReporter {
  /**
   * Print egress analysis table.
   */
  static printEgressTable(serviceName, egress) {
    const connections = egress.getAll();
    
    if (connections.length === 0) {
      console.log(chalk.gray(`   No outbound connections detected`));
      return;
    }

    const stats = egress.getStats();
    
    console.log(chalk.cyan(`\n📡 Egress Analysis: ${serviceName}`));
    console.log(chalk.gray(`   Total: ${stats.total} | RabbitMQ: ${stats.rabbitmq} | Kafka: ${stats.kafka} | HTTP: ${stats.http} | Insecure: ${stats.insecure} | External: ${stats.external}\n`));

    // Print table header
    const header = [
      'Type'.padEnd(12),
      'Method'.padEnd(12),
      'Rule'.padEnd(35),
      'Severity'.padEnd(10),
      'Target'.padEnd(40),
    ].join(' ');
    
    console.log(chalk.bold(`   ${header}`));
    console.log(chalk.gray(`   ${'─'.repeat(110)}`));

    // Print each connection
    for (const conn of connections) {
      const type = conn.type.toUpperCase().padEnd(12);
      const method = (conn.method || 'N/A').padEnd(12);
      const rule = conn.rule.padEnd(35);
      const severity = conn.getSeverity();
      // Industry-standard severity colors
      const severityFormatted = severity === 'OK' 
        ? chalk.green(severity.padEnd(10))           // OK: Green
        : severity === 'CRITICAL'
        ? chalk.red.bold(severity.padEnd(10))        // Critical: Bold Red
        : severity === 'HIGH'
        ? chalk.red(severity.padEnd(10))             // High: Red
        : severity === 'MEDIUM'
        ? chalk.yellow(severity.padEnd(10))          // Medium: Yellow
        : chalk.gray(severity.padEnd(10));           // Low/Other: Gray
      const target = chalk.gray(this.truncate(conn.target, 40).padEnd(40));

      console.log(`   ${type} ${method} ${rule} ${severityFormatted} ${target}`);
    }

    console.log('');
  }

  /**
   * Print egress summary grouped by category.
   */
  static printEgressSummary(egress) {
    const grouped = egress.groupByCategory();
    
    console.log(chalk.cyan('\n📊 Egress Summary by Category:\n'));

    for (const [category, connections] of Object.entries(grouped)) {
      console.log(chalk.bold(`   ${category} (${connections.length}):`));
      
      // Group by target within category
      const byTarget = {};
      for (const conn of connections) {
        if (!byTarget[conn.target]) {
          byTarget[conn.target] = [];
        }
        byTarget[conn.target].push(conn);
      }

      for (const [target, conns] of Object.entries(byTarget)) {
        const methods = [...new Set(conns.map(c => c.method))].join(', ');
        const secure = conns[0].isSecure() ? chalk.green('✓') : chalk.red('✗');
        console.log(`      ${secure} ${this.truncate(target, 60)} (${methods})`);
      }
      console.log('');
    }
  }

  /**
   * Print security warnings for egress.
   */
  static printEgressWarnings(egress) {
    const insecure = egress.getInsecure();
    
    if (insecure.length === 0) {
      console.log(chalk.green('   ✅ All outbound connections are secure\n'));
      return;
    }

    console.log(chalk.yellow(`\n⚠️  Insecure Outbound Connections (${insecure.length}):\n`));

    for (const conn of insecure) {
      console.log(chalk.red(`   ✗ ${conn.type.toUpperCase()} to ${conn.target}`));
      console.log(chalk.gray(`     File: ${conn.file}:${conn.line}`));
      console.log(chalk.gray(`     Context: ${conn.context}\n`));
    }
  }

  /**
   * Generate JSON report.
   */
  static generateJSON(egress) {
    const connections = egress.getAll().map(conn => ({
      type: conn.type,
      target: conn.target,
      method: conn.method,
      file: conn.file,
      line: conn.line,
      context: conn.context,
      secure: conn.isSecure(),
      external: conn.isExternal(),
      category: conn.getCategory(),
    }));

    return {
      summary: egress.getStats(),
      connections: connections,
      byCategory: this.groupForJSON(egress.groupByCategory()),
      byTarget: this.groupForJSON(egress.groupByTarget()),
    };
  }

  /**
   * Helper: Group connections for JSON output.
   */
  static groupForJSON(grouped) {
    const result = {};
    for (const [key, connections] of Object.entries(grouped)) {
      result[key] = connections.map(conn => ({
        type: conn.type,
        target: conn.target,
        method: conn.method,
        file: conn.file,
        line: conn.line,
      }));
    }
    return result;
  }

  /**
   * Helper: Truncate long strings.
   */
  static truncate(str, maxLen) {
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen - 3) + '...';
  }
}
