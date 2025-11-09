/**
 * Egress/Output Analysis Models
 * Tracks all outbound connections from microservices.
 */

/**
 * Represents a single outbound connection.
 */
export class EgressConnection {
  constructor({ type, target, method, file, line, context }) {
    this.type = type;           // 'rabbitmq', 'kafka', 'http', 'https', 'grpc', etc.
    this.target = target;       // URL, queue name, topic, or endpoint
    this.method = method;       // HTTP method, 'publish', 'send', etc.
    this.file = file;           // Source file
    this.line = line;           // Line number
    this.context = context;     // Additional context (function name, etc.)
    this.rule = this.determineRule(); // Security rule
  }

  /**
   * Check if this is a secure connection.
   */
  isSecure() {
    if (this.type === 'http') return false;
    
    // For RabbitMQ, only connection strings matter
    if (this.type === 'rabbitmq') {
      // If it's a connect() call, check the URL
      if (this.method === 'connect') {
        if (this.target.startsWith('amqp://')) return false;
        if (this.target.startsWith('amqps://')) return true;
        // Variables - we can't determine, mark as neutral (true)
        return true;
      }
      // For operations (publish, consume, etc.), they're neutral - not inherently secure/insecure
      // The security depends on the connection, not the operation
      return true;
    }
    
    // For Kafka, operations are neutral - security depends on client config
    if (this.type === 'kafka') {
      return true;
    }
    
    return true;
  }

  /**
   * Check if this is an external (3rd party) connection.
   */
  isExternal() {
    const internalPatterns = [
      /localhost/,
      /127\.0\.0\.1/,
      /0\.0\.0\.0/,
      /rabbitmq/,
      /kafka/,
      /mongodb/,
      /postgres/,
      /redis/,
      /\.local/,
    ];

    return !internalPatterns.some(pattern => pattern.test(this.target));
  }

  /**
   * Get connection category.
   */
  getCategory() {
    if (this.type === 'rabbitmq') return 'Message Broker (RabbitMQ)';
    if (this.type === 'kafka') return 'Message Broker (Kafka)';
    if (this.type === 'http' || this.type === 'https') {
      return this.isExternal() ? 'External API' : 'Internal Service';
    }
    return 'Other';
  }

  /**
   * Determine the security rule for this connection.
   */
  determineRule() {
    // HTTP connections
    if (this.type === 'http') {
      if (this.isExternal()) {
        return 'EGRESS_UNENCRYPTED_EXTERNAL_API'; // Critical - external API over HTTP
      }
      return 'EGRESS_INSECURE_HTTP'; // High - internal HTTP
    }

    // RabbitMQ connections
    if (this.type === 'rabbitmq' && this.method === 'connect') {
      if (this.target.startsWith('amqp://')) {
        return 'EGRESS_INSECURE_RABBITMQ'; // High - unencrypted RabbitMQ
      }
    }

    // Kafka connections - rule is set by config checker
    if (this.type === 'kafka') {
      return 'EGRESS_OK'; // Default to OK, actual issues flagged by config checker
    }

    // Everything else is OK
    return 'EGRESS_OK';
  }

  /**
   * Get rule severity.
   */
  getSeverity() {
    const severityMap = {
      'EGRESS_UNENCRYPTED_EXTERNAL_API': 'CRITICAL',
      'EGRESS_INSECURE_HTTP': 'HIGH',
      'EGRESS_INSECURE_RABBITMQ': 'HIGH',
      'EGRESS_INSECURE_KAFKA': 'HIGH',
      'EGRESS_OK': 'OK',
    };
    return severityMap[this.rule] || 'INFO';
  }
}

/**
 * Collection of egress connections with analysis methods.
 */
export class EgressCollection {
  constructor() {
    this.connections = [];
  }

  /**
   * Add a connection to the collection.
   */
  add(connection) {
    this.connections.push(connection);
  }

  /**
   * Get all connections.
   */
  getAll() {
    return this.connections;
  }

  /**
   * Get connections by type.
   */
  getByType(type) {
    return this.connections.filter(c => c.type === type);
  }

  /**
   * Get RabbitMQ connections.
   */
  getRabbitMQ() {
    return this.connections.filter(c => c.type === 'rabbitmq');
  }

  /**
   * Get Kafka connections.
   */
  getKafka() {
    return this.connections.filter(c => c.type === 'kafka');
  }

  /**
   * Get HTTP connections.
   */
  getHTTP() {
    return this.connections.filter(c => c.type === 'http' || c.type === 'https');
  }

  /**
   * Get insecure connections.
   */
  getInsecure() {
    return this.connections.filter(c => !c.isSecure());
  }

  /**
   * Get external (3rd party) connections.
   */
  getExternal() {
    return this.connections.filter(c => c.isExternal());
  }

  /**
   * Get internal (microservice-to-microservice) connections.
   */
  getInternal() {
    return this.connections.filter(c => !c.isExternal());
  }

  /**
   * Group connections by target.
   */
  groupByTarget() {
    const grouped = {};
    for (const conn of this.connections) {
      if (!grouped[conn.target]) {
        grouped[conn.target] = [];
      }
      grouped[conn.target].push(conn);
    }
    return grouped;
  }

  /**
   * Group connections by category.
   */
  groupByCategory() {
    const grouped = {};
    for (const conn of this.connections) {
      const category = conn.getCategory();
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(conn);
    }
    return grouped;
  }

  /**
   * Get statistics.
   */
  getStats() {
    return {
      total: this.connections.length,
      rabbitmq: this.getRabbitMQ().length,
      kafka: this.getKafka().length,
      http: this.getHTTP().length,
      insecure: this.getInsecure().length,
      external: this.getExternal().length,
      internal: this.getInternal().length,
    };
  }
}
