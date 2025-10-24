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
   * Generate markdown prompts
   */
  generate() {
    // Group by file
    const fileGroups = this.groupByFile();
    
    let markdown = '# Security Refactoring Prompts\n\n';
    markdown += `Generated: ${new Date().toLocaleString()}\n\n`;
    markdown += `Total Files: ${fileGroups.size}\n`;
    markdown += `Total Issues: ${this.findings.length}\n\n`;
    markdown += '---\n\n';

    // Generate prompt for each file
    for (const [filePath, findings] of fileGroups.entries()) {
      markdown += this.generateFilePrompt(filePath, findings);
      markdown += '\n---\n\n';
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
   * Generate prompt for one file
   */
  generateFilePrompt(filePath, findings) {
    let prompt = `## File: ${path.basename(filePath)}\n\n`;
    prompt += `**Path:** \`${filePath}\`\n\n`;
    prompt += `**Issues:** ${findings.length}\n\n`;

    // Group by rule
    const byRule = this.groupByRule(findings);

    prompt += '### Vulnerabilities\n\n';
    
    for (const [ruleId, items] of byRule.entries()) {
      const rule = RULES[ruleId];
      const severity = rule ? rule.severity.toUpperCase() : 'UNKNOWN';
      const description = rule ? rule.description : 'Unknown issue';
      
      prompt += `**[${ruleId}]** - ${severity}\n`;
      prompt += `- Description: ${description}\n`;
      
      if (items.length === 1) {
        prompt += `- Location: Line ${items[0].line || 'N/A'}\n`;
      } else {
        const lines = items.map(i => `line ${i.line || 'N/A'}`).join(', ');
        prompt += `- Locations: ${lines}\n`;
      }
      
      prompt += '\n';
    }

    // Get code context
    prompt += '### Code Context\n\n';
    
    try {
      // Check if it's a directory (microservice-level finding)
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        prompt += `*This is a microservice-level issue. The vulnerability affects the entire service configuration.*\n\n`;
        prompt += `**Service Directory:** \`${filePath}\`\n\n`;
        prompt += `Check the main entry point (e.g., app.js, index.js, main.ts) and configuration files.\n\n`;
      } else {
        // It's a file, read it
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const lines = fileContent.split('\n');
        
        // Check if we should include full file or sections
        if (this.shouldIncludeFullFile(byRule, lines.length)) {
          prompt += '```\n';
          prompt += fileContent;
          prompt += '\n```\n\n';
        } else {
          // Extract relevant sections
          const sections = this.extractSections(findings, lines);
          for (const section of sections) {
            prompt += `**Lines ${section.start}-${section.end}:**\n\n`;
            prompt += '```\n';
            prompt += section.code;
            prompt += '\n```\n\n';
          }
        }
      }
    } catch (error) {
      prompt += `⚠️ Error: ${error.message}\n\n`;
    }

    // Required fixes
    prompt += '### Required Fixes\n\n';
    for (const [ruleId] of byRule.entries()) {
      const guidance = this.getFixGuidance(ruleId);
      prompt += `- **${ruleId}:** ${guidance}\n`;
    }
    prompt += '\n';

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
   * Should we include full file?
   */
  shouldIncludeFullFile(byRule, lineCount) {
    // Include full file for docker-compose, small files, or file-wide issues
    if (lineCount < 100) return true;
    
    const fileWideRules = [
      'MISSING_HELMET', 'MISSING_RATE_LIMITING', 'MISSING_AUTHENTICATION',
      'NESTJS_MISSING_HELMET', 'NESTJS_MISSING_RATE_LIMIT', 'NESTJS_MISSING_GUARDS',
      'FASTIFY_MISSING_HELMET', 'FASTIFY_MISSING_RATE_LIMIT'
    ];
    
    for (const rule of byRule.keys()) {
      if (fileWideRules.includes(rule)) return true;
    }
    
    return false;
  }

  /**
   * Extract code sections around issues
   */
  extractSections(findings, lines) {
    const sections = [];
    const processed = new Set();
    
    for (const finding of findings) {
      if (!finding.line) continue;
      
      const contextLines = 10;
      const start = Math.max(1, finding.line - contextLines);
      const end = Math.min(lines.length, finding.line + contextLines);
      const key = `${start}-${end}`;
      
      if (processed.has(key)) continue;
      processed.add(key);
      
      sections.push({
        start,
        end,
        code: lines.slice(start - 1, end).join('\n')
      });
    }
    
    return sections.sort((a, b) => a.start - b.start);
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
      'EGRESS_INSECURE_RABBITMQ': 'Use amqps:// with TLS'
    };
    
    return guidance[ruleId] || 'Apply security best practices';
  }
}
