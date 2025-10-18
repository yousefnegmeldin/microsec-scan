import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import { createFinding } from "../../rules/registry.js";

/**
 * AST-based framework configuration checker.
 * Checks for security misconfigurations in Express, NestJS, Fastify.
 */

/**
 * Check for helmet middleware using AST.
 */
export function checkHelmetAST(file, content) {
  const findings = [];

  try {
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      errorRecovery: true,
    });

    let hasHelmet = false;

    traverse.default(ast, {
      // Find: app.use(helmet())
      CallExpression(path) {
        const callee = path.node.callee;
        
        // Check for helmet() call
        if (callee.type === 'Identifier' && callee.name === 'helmet') {
          hasHelmet = true;
        }
        
        // Check for app.use(helmet())
        if (callee.type === 'MemberExpression' &&
            callee.property.name === 'use') {
          const args = path.node.arguments;
          if (args.length > 0 && args[0].type === 'CallExpression') {
            if (args[0].callee.name === 'helmet') {
              hasHelmet = true;
            }
          }
        }
      },
      
      // Check imports: import helmet from 'helmet'
      ImportDeclaration(path) {
        if (path.node.source.value === 'helmet' ||
            path.node.source.value === '@fastify/helmet' ||
            path.node.source.value === 'fastify-helmet') {
          hasHelmet = true;
        }
      },
    });

    return hasHelmet;
  } catch (err) {
    return false;
  }
}

/**
 * Check for CORS misconfiguration using AST.
 */
export function checkCORSAST(file, content) {
  const findings = [];

  try {
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      errorRecovery: true,
    });

    traverse.default(ast, {
      CallExpression(path) {
        const callee = path.node.callee;
        
        // Express: app.use(cors({ origin: '*' }))
        if (callee.type === 'Identifier' && callee.name === 'cors') {
          const args = path.node.arguments;
          if (args.length > 0 && args[0].type === 'ObjectExpression') {
            for (const prop of args[0].properties) {
              if (prop.key.name === 'origin') {
                if (prop.value.type === 'StringLiteral' && prop.value.value === '*') {
                  findings.push(createFinding(
                    "PERMISSIVE_CORS",
                    file,
                    path.node.loc?.start.line || 1,
                    "CORS configured with overly permissive origin (allows all domains)"
                  ));
                } else if (prop.value.type === 'BooleanLiteral' && prop.value.value === true) {
                  findings.push(createFinding(
                    "PERMISSIVE_CORS",
                    file,
                    path.node.loc?.start.line || 1,
                    "CORS configured with overly permissive origin (allows all domains)"
                  ));
                }
              }
            }
          }
        }
        
        // NestJS: app.enableCors({ origin: true })
        if (callee.type === 'MemberExpression' &&
            callee.property.name === 'enableCors') {
          const args = path.node.arguments;
          if (args.length > 0 && args[0].type === 'ObjectExpression') {
            for (const prop of args[0].properties) {
              if (prop.key.name === 'origin') {
                if (prop.value.type === 'StringLiteral' && prop.value.value === '*') {
                  findings.push(createFinding(
                    "PERMISSIVE_CORS",
                    file,
                    path.node.loc?.start.line || 1,
                    "CORS configured with overly permissive origin (allows all domains)"
                  ));
                } else if (prop.value.type === 'BooleanLiteral' && prop.value.value === true) {
                  findings.push(createFinding(
                    "PERMISSIVE_CORS",
                    file,
                    path.node.loc?.start.line || 1,
                    "CORS configured with overly permissive origin (allows all domains)"
                  ));
                }
              }
            }
          }
        }
      },
    });
  } catch (err) {
    // Skip parse errors
  }

  return findings;
}

/**
 * Check for rate limiting using AST.
 */
export function checkRateLimitingAST(file, content) {
  try {
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      errorRecovery: true,
    });

    let hasRateLimit = false;

    traverse.default(ast, {
      // Check for rate limit imports
      ImportDeclaration(path) {
        const source = path.node.source.value;
        if (source.includes('rate-limit') || 
            source.includes('ratelimit') ||
            source === '@nestjs/throttler') {
          hasRateLimit = true;
        }
      },
      
      // Check for rate limit usage
      CallExpression(path) {
        const callee = path.node.callee;
        if (callee.type === 'Identifier') {
          if (callee.name.toLowerCase().includes('ratelimit') ||
              callee.name.toLowerCase().includes('throttle')) {
            hasRateLimit = true;
          }
        }
      },
    });

    return hasRateLimit;
  } catch (err) {
    return false;
  }
}

/**
 * Check for body size limits using AST.
 */
export function checkBodySizeLimitAST(file, content) {
  try {
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      errorRecovery: true,
    });

    let hasLimit = false;

    traverse.default(ast, {
      CallExpression(path) {
        const callee = path.node.callee;
        
        // express.json({ limit: '10mb' })
        if (callee.type === 'MemberExpression') {
          if ((callee.property.name === 'json' || callee.property.name === 'urlencoded')) {
            const args = path.node.arguments;
            if (args.length > 0 && args[0].type === 'ObjectExpression') {
              for (const prop of args[0].properties) {
                if (prop.key.name === 'limit') {
                  hasLimit = true;
                }
              }
            }
          }
        }
      },
    });

    return hasLimit;
  } catch (err) {
    return false;
  }
}

/**
 * Check for NestJS ValidationPipe using AST.
 */
export function checkValidationPipeAST(file, content) {
  try {
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['typescript', 'decorators-legacy'],
      errorRecovery: true,
    });

    let hasValidationPipe = false;

    traverse.default(ast, {
      // Check for ValidationPipe import
      ImportDeclaration(path) {
        const specifiers = path.node.specifiers;
        for (const spec of specifiers) {
          if (spec.imported?.name === 'ValidationPipe') {
            hasValidationPipe = true;
          }
        }
      },
      
      // Check for useGlobalPipes(new ValidationPipe())
      CallExpression(path) {
        const callee = path.node.callee;
        if (callee.type === 'MemberExpression' &&
            callee.property.name === 'useGlobalPipes') {
          const args = path.node.arguments;
          if (args.length > 0 && args[0].type === 'NewExpression') {
            if (args[0].callee.name === 'ValidationPipe') {
              hasValidationPipe = true;
            }
          }
        }
      },
    });

    return hasValidationPipe;
  } catch (err) {
    return false;
  }
}

/**
 * Check for exposed debug/internal endpoints using AST.
 */
export function checkExposedEndpointsAST(file, content) {
  const findings = [];

  try {
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      errorRecovery: true,
    });

    const suspiciousPatterns = [
      /\/debug/i,
      /\/admin/i,
      /\/internal/i,
      /\/test/i,
      /\/dev/i,
    ];

    traverse.default(ast, {
      StringLiteral(path) {
        const value = path.node.value;
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(value) && value.startsWith('/')) {
            findings.push(createFinding(
              "EXPOSED_INTERNAL_ENDPOINT",
              file,
              path.node.loc?.start.line || 1,
              `Potentially exposed debug/internal endpoint detected`
            ));
            break;
          }
        }
      },
    });
  } catch (err) {
    // Skip parse errors
  }

  return findings;
}
