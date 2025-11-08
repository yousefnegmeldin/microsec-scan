/**
 * Simple Prompt Generator
 * Takes scan findings and generates markdown prompts with code context
 */

import fs from 'fs';
import path from 'path';
import { RULES } from '../rules/registry.js';

export class PromptGenerator {
  constructor(findings) {
    this.findings = findings;
  }

  /**
   * Generate dev-friendly markdown prompts
   */
  generate() {
    const fileGroups = this.groupByFile();
    
    // Calculate summary stats
    const stats = this.calculateStats(this.findings);
    
    let markdown = '# 🔒 Security Refactoring Guide\n\n';
    markdown += `**Generated:** ${new Date().toLocaleString()}\n\n`;
    
    // Summary table
    markdown += '## 📊 Summary\n\n';
    markdown += '| Metric | Count |\n';
    markdown += '|--------|-------|\n';
    markdown += `| Total Files | ${fileGroups.size} |\n`;
    markdown += `| Total Issues | ${this.findings.length} |\n`;
    markdown += `| Critical | ${stats.critical} |\n`;
    markdown += `| High | ${stats.high} |\n`;
    markdown += `| Medium | ${stats.medium} |\n`;
    markdown += `| Low | ${stats.low} |\n\n`;
    
    // Vulnerability breakdown
    markdown += '## 🎯 Vulnerability Breakdown\n\n';
    const ruleStats = this.getRuleStats(this.findings);
    markdown += '| Rule | Count | Severity |\n';
    markdown += '|------|-------|----------|\n';
    ruleStats.forEach(rs => {
      markdown += `| ${rs.rule} | ${rs.count} | ${rs.severity.toUpperCase()} |\n`;
    });
    markdown += '\n';
    
    markdown += '---\n\n';
    markdown += '# 📁 File-by-File Fixes\n\n';

    // Generate prompt for each file
    let fileNum = 1;
    for (const [filePath, findings] of fileGroups.entries()) {
      markdown += this.generateFilePrompt(filePath, findings, fileNum);
      markdown += '\n---\n\n';
      fileNum++;
    }

    return markdown;
  }

  /**
   * Group findings by file
   */
  groupByFile() {
    const groups = new Map();
    
    for (const finding of this.findings) {
      if (!finding.file) continue;
      
      if (!groups.has(finding.file)) {
        groups.set(finding.file, []);
      }
      groups.get(finding.file).push(finding);
    }
    
    return groups;
  }

  /**
   * Generate detailed, dev-friendly prompt for one file
   */
  generateFilePrompt(filePath, findings, fileNum) {
    const fileName = path.basename(filePath);
    const byRule = this.groupByRule(findings);
    
    let prompt = `## ${fileNum}. ${fileName}\n\n`;
    prompt += `**📂 Path:** \`${filePath}\`  \n`;
    prompt += `**🐛 Issues:** ${findings.length}  \n\n`;

    // Vulnerability table
    prompt += '### 🚨 Vulnerabilities\n\n';
    prompt += '| # | Rule | Severity | Line(s) | Description |\n';
    prompt += '|---|------|----------|---------|-------------|\n';
    
    let issueNum = 1;
    for (const [ruleId, items] of byRule.entries()) {
      const rule = RULES[ruleId];
      const severity = rule ? rule.severity.toUpperCase() : 'UNKNOWN';
      const description = rule ? rule.description : 'Unknown issue';
      
      // Get line numbers (filter out null/undefined)
      const lineNumbers = items.map(i => i.line).filter(l => l != null && l > 0);
      const lineStr = lineNumbers.length > 0 ? 
                      (lineNumbers.length === 1 ? `L${lineNumbers[0]}` : `L${Math.min(...lineNumbers)}-L${Math.max(...lineNumbers)}`) :
                      'Multiple';
      
      const severityEmoji = severity === 'CRITICAL' ? '🔴' : 
                           severity === 'HIGH' ? '🟠' : 
                           severity === 'MEDIUM' ? '🟡' : '⚪';
      
      prompt += `| ${issueNum} | \`${ruleId}\` | ${severityEmoji} ${severity} | ${lineStr} | ${description} |\n`;
      issueNum++;
    }
    
    prompt += '\n';

    // Fix guidance
    prompt += '### 💡 Fix Guidance\n\n';
    for (const [ruleId] of byRule.entries()) {
      const guidance = this.getFixGuidance(ruleId);
      prompt += `- **${ruleId}:** ${guidance}\n`;
    }
    prompt += '\n';

    // Code context
    prompt += '### 📝 Code Context\n\n';
    
    try {
      if (!fs.existsSync(filePath)) {
        prompt += `⚠️ File not found: \`${filePath}\`\n\n`;
        return prompt;
      }
      
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        prompt += `> ℹ️ **Microservice-level issue** - affects entire service configuration\n\n`;
        prompt += `**Service Directory:** \`${filePath}\`\n\n`;
        prompt += 'Check main entry point (app.js, index.js, main.ts) and configuration files.\n\n';
      } else {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const lines = fileContent.split('\n');
        const totalLines = lines.length;
        
        // Determine language for syntax highlighting
        const ext = path.extname(filePath);
        const lang = ext === '.ts' ? 'typescript' : 
                     ext === '.js' ? 'javascript' :
                     ext === '.yml' || ext === '.yaml' ? 'yaml' : '';
        
        // Check if we should include full file
        if (this.shouldIncludeFullFile(byRule, totalLines)) {
          prompt += `**Full file** (${totalLines} lines):\n\n`;
          prompt += '```' + lang + '\n';
          // Add line numbers
          lines.forEach((line, idx) => {
            const lineNum = String(idx + 1).padStart(4, ' ');
            prompt += `${lineNum} │ ${line}\n`;
          });
          prompt += '```\n\n';
        } else {
          // Extract relevant sections with line numbers
          const sections = this.extractSectionsWithContext(findings, lines);
          
          if (sections.length === 0) {
            // Fallback: show full file if no sections
            prompt += `**Full file** (${totalLines} lines):\n\n`;
            prompt += '```' + lang + '\n';
            lines.forEach((line, idx) => {
              const lineNum = String(idx + 1).padStart(4, ' ');
              prompt += `${lineNum} │ ${line}\n`;
            });
            prompt += '```\n\n';
          } else {
            prompt += `**Relevant sections** (${sections.length} ${sections.length === 1 ? 'section' : 'sections'}):\n\n`;
            sections.forEach((section, idx) => {
              prompt += `<details>\n<summary><b>Section ${idx + 1}: Lines ${section.start}-${section.end}</b> (${section.end - section.start + 1} lines)</summary>\n\n`;
              prompt += '```' + lang + '\n';
              for (let i = section.start - 1; i < section.end; i++) {
                if (i >= 0 && i < lines.length) {
                  const lineNum = String(i + 1).padStart(4, ' ');
                  const isIssue = section.issueLines.includes(i + 1);
                  const marker = isIssue ? '👉' : '  ';
                  prompt += `${lineNum} ${marker} ${lines[i]}\n`;
                }
              }
              prompt += '```\n</details>\n\n';
            });
          }
        }
      }
    } catch (error) {
      prompt += `⚠️ **Error reading file:** ${error.message}\n\n`;
    }

    return prompt;
  }

  /**
   * Group findings by rule
   */
  groupByRule(findings) {
    const groups = new Map();
    
    for (const finding of findings) {
      if (!groups.has(finding.rule)) {
        groups.set(finding.rule, []);
      }
      groups.get(finding.rule).push(finding);
    }
    
    return groups;
  }

  /**
   * Calculate summary statistics
   */
  calculateStats(findings) {
    return {
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length
    };
  }

  /**
   * Get rule statistics
   */
  getRuleStats(findings) {
    const ruleMap = new Map();
    findings.forEach(f => {
      const count = ruleMap.get(f.rule) || 0;
      ruleMap.set(f.rule, count + 1);
    });
    
    return Array.from(ruleMap.entries())
      .map(([rule, count]) => ({
        rule,
        count,
        severity: RULES[rule]?.severity || 'unknown'
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Extract sections around vulnerable lines with better context
   */
  extractSectionsWithContext(findings, lines) {
    const sections = [];
    const contextLines = 15; // Show 15 lines before/after for better context
    
    // Get unique line numbers with actual values
    const lineNumbers = [...new Set(
      findings
        .map(f => f.line)
        .filter(l => l != null && l > 0)
    )].sort((a, b) => a - b);
    
    if (lineNumbers.length === 0) {
      // No specific lines - return empty to trigger full file display
      return [];
    }
    
    // Merge overlapping sections
    let currentSection = null;
    
    for (const lineNum of lineNumbers) {
      const start = Math.max(1, lineNum - contextLines);
      const end = Math.min(lines.length, lineNum + contextLines);
      
      if (!currentSection || start > currentSection.end + 5) {
        // Start new section (allow 5-line gap before splitting)
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = { 
          start, 
          end,
          issueLines: [lineNum]
        };
      } else {
        // Extend current section
        currentSection.end = Math.max(currentSection.end, end);
        currentSection.issueLines.push(lineNum);
      }
    }
    
    if (currentSection) {
      sections.push(currentSection);
    }
    
    return sections;
  }

  /**
   * Get fix guidance
   */
  getFixGuidance(ruleId) {
    const guidance = {
      'MISSING_HELMET': 'Add helmet middleware for security headers',
      'MISSING_RATE_LIMITING': 'Implement rate limiting to prevent abuse',
      'PERMISSIVE_CORS': 'Restrict CORS to specific origins',
      'MISSING_AUTHENTICATION': 'Add JWT authentication middleware',
      'HARDCODED_SECRET': 'Move secrets to environment variables',
      'PLAINTEXT_BROKER': 'Enable TLS (amqp:// → amqps://)',
      'DEFAULT_CREDENTIALS': 'Use secure credentials from environment',
      'INSECURE_HTTP': 'Use HTTPS instead of HTTP',
      'ROOT_CONTAINER': 'Add USER directive in Dockerfile',
      'MISSING_BODY_SIZE_LIMIT': 'Add body size limits',
      'UNPROTECTED_ROUTE': 'Add authentication to route',
      'EXPOSED_INTERNAL_ENDPOINT': 'Protect or remove endpoint',
      'NESTJS_MISSING_GUARDS': 'Add @UseGuards(JwtAuthGuard)',
      'NESTJS_MISSING_VALIDATION_PIPE': 'Add ValidationPipe in main.ts',
      'NESTJS_MISSING_HELMET': 'Configure helmet in main.ts',
      'NESTJS_MISSING_RATE_LIMIT': 'Add @nestjs/throttler',
      'NESTJS_PERMISSIVE_CORS': 'Restrict CORS in enableCors()',
      'FASTIFY_MISSING_HELMET': 'Register @fastify/helmet',
      'FASTIFY_MISSING_RATE_LIMIT': 'Register @fastify/rate-limit',
      'FASTIFY_MISSING_AUTH': 'Add authentication hooks',
      'EGRESS_INSECURE_HTTP': 'Use HTTPS for API calls',
      'EGRESS_INSECURE_RABBITMQ': 'Use amqps:// with TLS',
      'MISSING_SERVICE_AUTH': 'Add JWT/API key authentication to service-to-service calls',
      'MISSING_MESSAGE_VALIDATION': 'Implement JSON Schema or Avro validation for messages',
      'EXCESSIVE_SERVICE_TRUST': 'Restrict network access using least privilege principle',
      'MISSING_MUTUAL_TLS': 'Configure mTLS with httpsAgent and client certificates',
      'SHARED_BROKER_CREDENTIALS': 'Create separate RabbitMQ users per service with unique credentials',
      'MISSING_CIRCUIT_BREAKER': 'Implement circuit breaker with opossum or similar library',
      'MISSING_REQUEST_SIGNING': 'Implement HMAC request signing with shared secret',
      'SERVICE_REGISTRY_POISONING': 'Enable ACL/authentication on Consul/Eureka registry',
      'MISSING_QUEUE_AUTHORIZATION': 'Configure RabbitMQ vhost permissions and queue ACLs',
      'MISSING_MESSAGE_ENCRYPTION': 'Encrypt messages before publishing using crypto library',
      'EXPOSED_INTERNAL_PORT': 'Bind internal ports to 127.0.0.1 instead of 0.0.0.0',
      'UNENCRYPTED_SERVICE_MESH': 'Enable mTLS in Istio/Linkerd with PeerAuthentication'
    };
    
    return guidance[ruleId] || 'Apply security best practices';
  }
}
