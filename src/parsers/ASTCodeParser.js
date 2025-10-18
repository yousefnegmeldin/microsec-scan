import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import { createFinding } from "../rules/registry.js";
import fs from "fs";

/**
 * AST-based code parser for detecting security issues in source code.
 * Replaces regex-based detection with proper AST analysis.
 */

/**
 * Analyze source code file using AST.
 */
export function analyzeSource(file, verbose = false) {
  const findings = [];

  try {
    const code = fs.readFileSync(file, "utf8");
    
    // Parse code into AST
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      errorRecovery: true,
    });

    // Run all checks
    findings.push(...checkPlaintextAMQP(file, ast, code));
    findings.push(...checkInsecureHTTP(file, ast, code));
    findings.push(...checkHardcodedSecrets(file, ast, code));

    if (verbose && findings.length > 0) {
      console.log(`    PlaintextAMQP: ${findings.filter(f => f.rule === 'PLAINTEXT_BROKER').length}, InsecureHTTP: ${findings.filter(f => f.rule === 'INSECURE_HTTP').length}, HardcodedSecrets: ${findings.filter(f => f.rule === 'HARDCODED_SECRET').length}`);
    }
  } catch (err) {
    // Skip files with syntax errors
    if (verbose && err.code !== 'BABEL_PARSE_ERROR') {
      console.error(`AST parse error in ${file}:`, err.message);
    }
  }

  return findings;
}

/**
 * Check for plaintext AMQP connections using AST.
 */
function checkPlaintextAMQP(file, ast, code) {
  const findings = [];

  traverse.default(ast, {
    // Find string literals containing amqp://
    StringLiteral(path) {
      const value = path.node.value;
      if (/^amqp:\/\//.test(value)) {
        findings.push(createFinding(
          "PLAINTEXT_BROKER",
          file,
          path.node.loc?.start.line || 1,
          "RabbitMQ uses non-TLS amqp:// connection"
        ));
      }
    },
    
    // Find template literals containing amqp://
    TemplateLiteral(path) {
      const quasi = path.node.quasis[0];
      if (quasi && /amqp:\/\//.test(quasi.value.raw)) {
        findings.push(createFinding(
          "PLAINTEXT_BROKER",
          file,
          path.node.loc?.start.line || 1,
          "RabbitMQ uses non-TLS amqp:// connection"
        ));
      }
    },
  });

  return findings;
}

/**
 * Check for insecure HTTP connections using AST.
 */
function checkInsecureHTTP(file, ast, code) {
  const findings = [];

  traverse.default(ast, {
    // Find string literals containing http://
    StringLiteral(path) {
      const value = path.node.value;
      // Match http:// but not in comments or localhost
      if (/^http:\/\/(?!localhost|127\.0\.0\.1)/.test(value)) {
        findings.push(createFinding(
          "INSECURE_HTTP",
          file,
          path.node.loc?.start.line || 1
        ));
      }
    },
    
    // Find template literals containing http://
    TemplateLiteral(path) {
      const quasi = path.node.quasis[0];
      if (quasi && /http:\/\/(?!localhost|127\.0\.0\.1)/.test(quasi.value.raw)) {
        findings.push(createFinding(
          "INSECURE_HTTP",
          file,
          path.node.loc?.start.line || 1
        ));
      }
    },
  });

  return findings;
}

/**
 * Check for hardcoded secrets using AST.
 */
function checkHardcodedSecrets(file, ast, code) {
  const findings = [];

  // Patterns that indicate secrets
  const secretPatterns = [
    /password\s*[:=]\s*['"`][^'"`]{3,}['"`]/i,
    /api[_-]?key\s*[:=]\s*['"`][^'"`]{10,}['"`]/i,
    /secret\s*[:=]\s*['"`][^'"`]{10,}['"`]/i,
    /token\s*[:=]\s*['"`][^'"`]{10,}['"`]/i,
    /private[_-]?key\s*[:=]\s*['"`][^'"`]{10,}['"`]/i,
  ];

  traverse.default(ast, {
    // Check variable declarations
    VariableDeclarator(path) {
      const id = path.node.id;
      const init = path.node.init;

      if (!init || init.type !== 'StringLiteral') return;

      const varName = id.name?.toLowerCase() || '';
      const value = init.value;

      // Check if variable name suggests a secret
      if (
        (varName.includes('password') || 
         varName.includes('secret') || 
         varName.includes('apikey') ||
         varName.includes('api_key') ||
         varName.includes('token')) &&
        value.length > 5 &&
        !/^(test|example|placeholder|xxx|123)/i.test(value)
      ) {
        findings.push(createFinding(
          "HARDCODED_SECRET",
          file,
          path.node.loc?.start.line || 1,
          `Potential hardcoded secret in variable '${id.name}'`
        ));
      }
    },

    // Check object properties
    ObjectProperty(path) {
      const key = path.node.key;
      const value = path.node.value;

      if (value.type !== 'StringLiteral') return;

      const keyName = key.name || key.value || '';
      const keyLower = keyName.toLowerCase();
      const valueStr = value.value;

      // Check if property name suggests a secret
      if (
        (keyLower.includes('password') || 
         keyLower.includes('secret') || 
         keyLower.includes('apikey') ||
         keyLower.includes('api_key') ||
         keyLower.includes('token')) &&
        valueStr.length > 5 &&
        !/^(test|example|placeholder|xxx|123)/i.test(valueStr)
      ) {
        findings.push(createFinding(
          "HARDCODED_SECRET",
          file,
          path.node.loc?.start.line || 1,
          `Potential hardcoded secret in property '${keyName}'`
        ));
      }
    },
  });

  return findings;
}
