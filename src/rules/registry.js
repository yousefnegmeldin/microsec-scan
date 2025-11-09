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
  KAFKA_PLAINTEXT: {
    id: "KAFKA_PLAINTEXT",
    severity: "high",
    description: "Kafka connection without SSL/TLS encryption (PLAINTEXT protocol)",
  },
  KAFKA_MISSING_SASL: {
    id: "KAFKA_MISSING_SASL",
    severity: "high",
    description: "Kafka connection without SASL authentication",
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
  EGRESS_INSECURE_KAFKA: {
    id: "EGRESS_INSECURE_KAFKA",
    severity: "high",
    description: "Kafka connection without SSL/TLS encryption",
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

  // Inter-Service Security Rules (Phase 2)
  MISSING_SERVICE_AUTH: {
    id: "MISSING_SERVICE_AUTH",
    severity: "critical",
    description: "Service-to-service call without authentication (no JWT, mTLS, or API key header)",
  },
  MISSING_MESSAGE_VALIDATION: {
    id: "MISSING_MESSAGE_VALIDATION",
    severity: "medium",
    description: "RabbitMQ message lacks schema validation (no JSON Schema, Avro, or Protobuf)",
  },
  KAFKA_MISSING_SCHEMA_VALIDATION: {
    id: "KAFKA_MISSING_SCHEMA_VALIDATION",
    severity: "medium",
    description: "Kafka message lacks schema validation (no Avro, Protobuf, or Schema Registry)",
  },
  EXCESSIVE_SERVICE_TRUST: {
    id: "EXCESSIVE_SERVICE_TRUST",
    severity: "high",
    description: "Service has unnecessary network access to other services (violates least privilege)",
  },
  MISSING_MUTUAL_TLS: {
    id: "MISSING_MUTUAL_TLS",
    severity: "high",
    description: "Service-to-service communication without mutual TLS (mTLS)",
  },
  SHARED_BROKER_CREDENTIALS: {
    id: "SHARED_BROKER_CREDENTIALS",
    severity: "high",
    description: "Multiple services sharing same RabbitMQ credentials (violates isolation)",
  },
  MISSING_CIRCUIT_BREAKER: {
    id: "MISSING_CIRCUIT_BREAKER",
    severity: "medium",
    description: "Service-to-service call without circuit breaker pattern (resilience risk)",
  },

  MISSING_REQUEST_SIGNING: {
    id: "MISSING_REQUEST_SIGNING",
    severity: "high",
    description: "HTTP requests not signed with HMAC/signature (vulnerable to tampering)",
  },
  SERVICE_REGISTRY_POISONING: {
    id: "SERVICE_REGISTRY_POISONING",
    severity: "critical",
    description: "Service registry (Consul/Eureka) lacks authentication/validation (poisoning risk)",
  },
  MISSING_QUEUE_AUTHORIZATION: {
    id: "MISSING_QUEUE_AUTHORIZATION",
    severity: "high",
    description: "RabbitMQ queue lacks ACL permissions (any service can access any queue)",
  },
  MISSING_MESSAGE_ENCRYPTION: {
    id: "MISSING_MESSAGE_ENCRYPTION",
    severity: "high",
    description: "Message broker messages not encrypted at rest (sensitive data exposure)",
  },
  EXPOSED_INTERNAL_PORT: {
    id: "EXPOSED_INTERNAL_PORT",
    severity: "critical",
    description: "Internal service port exposed to public internet (attack surface expansion)",
  },
  UNENCRYPTED_SERVICE_MESH: {
    id: "UNENCRYPTED_SERVICE_MESH",
    severity: "high",
    description: "Service mesh (Istio/Linkerd) not enforcing TLS encryption between services",
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
