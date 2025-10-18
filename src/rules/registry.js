/**
 * Centralized rule registry for all security checks.
 * Each rule has an ID, severity, and description.
 */

export const RULES = {
  // Docker/Infrastructure Rules
  ROOT_CONTAINER: {
    id: "ROOT_CONTAINER",
    severity: "medium",
    description: "Container runs as root user",
  },
  DEFAULT_CREDENTIALS: {
    id: "DEFAULT_CREDENTIALS",
    severity: "high",
    description: "Service uses default credentials",
  },
  PLAINTEXT_BROKER: {
    id: "PLAINTEXT_BROKER",
    severity: "high",
    description: "Message broker connection not encrypted (no TLS)",
  },

  // Code-level Rules
  INSECURE_HTTP: {
    id: "INSECURE_HTTP",
    severity: "medium",
    description: "HTTP connection instead of HTTPS",
  },
  HARDCODED_SECRET: {
    id: "HARDCODED_SECRET",
    severity: "high",
    description: "Hardcoded secret or credential detected",
  },

  // Express/Microservice Rules
  MISSING_HELMET: {
    id: "MISSING_HELMET",
    severity: "high",
    description: "App missing helmet middleware for security headers",
  },
  MISSING_RATE_LIMITING: {
    id: "MISSING_RATE_LIMITING",
    severity: "high",
    description: "App missing rate limiting middleware",
  },
  PERMISSIVE_CORS: {
    id: "PERMISSIVE_CORS",
    severity: "medium",
    description: "CORS configured with overly permissive origin",
  },
  MISSING_AUTHENTICATION: {
    id: "MISSING_AUTHENTICATION",
    severity: "high",
    description: "No authentication middleware detected",
  },
  MISSING_BODY_SIZE_LIMIT: {
    id: "MISSING_BODY_SIZE_LIMIT",
    severity: "medium",
    description: "Body parser missing size limit (vulnerable to large payload attacks)",
  },
  EXPOSED_INTERNAL_ENDPOINT: {
    id: "EXPOSED_INTERNAL_ENDPOINT",
    severity: "high",
    description: "Potentially exposed internal/debug endpoint",
  },
  UNPROTECTED_ROUTE: {
    id: "UNPROTECTED_ROUTE",
    severity: "high",
    description: "Sensitive route lacks authentication middleware",
  },

  // Fastify-specific Rules
  FASTIFY_MISSING_HELMET: {
    id: "FASTIFY_MISSING_HELMET",
    severity: "high",
    description: "Fastify app missing @fastify/helmet plugin for security headers",
  },
  FASTIFY_MISSING_RATE_LIMIT: {
    id: "FASTIFY_MISSING_RATE_LIMIT",
    severity: "high",
    description: "Fastify app missing @fastify/rate-limit plugin",
  },
  FASTIFY_PERMISSIVE_CORS: {
    id: "FASTIFY_PERMISSIVE_CORS",
    severity: "medium",
    description: "Fastify CORS configured with overly permissive origin",
  },
  FASTIFY_MISSING_AUTH: {
    id: "FASTIFY_MISSING_AUTH",
    severity: "high",
    description: "No authentication hooks or plugins detected in Fastify app",
  },

  // NestJS-specific Rules
  NESTJS_MISSING_HELMET: {
    id: "NESTJS_MISSING_HELMET",
    severity: "high",
    description: "NestJS app missing helmet middleware for security headers",
  },
  NESTJS_MISSING_RATE_LIMIT: {
    id: "NESTJS_MISSING_RATE_LIMIT",
    severity: "high",
    description: "NestJS app missing rate limiting (throttler)",
  },
  NESTJS_PERMISSIVE_CORS: {
    id: "NESTJS_PERMISSIVE_CORS",
    severity: "medium",
    description: "NestJS CORS configured with overly permissive origin",
  },
  NESTJS_MISSING_GUARDS: {
    id: "NESTJS_MISSING_GUARDS",
    severity: "high",
    description: "No authentication guards detected in NestJS app",
  },
  NESTJS_MISSING_VALIDATION_PIPE: {
    id: "NESTJS_MISSING_VALIDATION_PIPE",
    severity: "medium",
    description: "NestJS app missing global ValidationPipe",
  },

  // Egress/Output Rules
  EGRESS_INSECURE_HTTP: {
    id: "EGRESS_INSECURE_HTTP",
    severity: "high",
    description: "Outbound HTTP call without TLS encryption",
  },
  EGRESS_INSECURE_RABBITMQ: {
    id: "EGRESS_INSECURE_RABBITMQ",
    severity: "high",
    description: "RabbitMQ connection without TLS (amqp:// instead of amqps://)",
  },
  EGRESS_UNENCRYPTED_EXTERNAL_API: {
    id: "EGRESS_UNENCRYPTED_EXTERNAL_API",
    severity: "critical",
    description: "External API call over unencrypted HTTP",
  },
  EGRESS_OK: {
    id: "EGRESS_OK",
    severity: "info",
    description: "Secure outbound connection",
  },
};

/**
 * Creates a finding object with consistent structure.
 */
export function createFinding(ruleId, file, line, additionalMessage = "") {
  const rule = RULES[ruleId];
  
  if (!rule) {
    throw new Error(`Unknown rule ID: ${ruleId}`);
  }

  const message = additionalMessage 
    ? `${additionalMessage}` 
    : rule.description;

  return {
    rule: rule.id,
    severity: rule.severity,
    message,
    file,
    line,
  };
}
