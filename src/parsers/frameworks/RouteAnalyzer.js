/**
 * Route data structure and analysis utilities for Express.js route mapping.
 */

/**
 * Represents a single route in an Express application.
 */
export class Route {
  constructor(data) {
    this.method = data.method || 'UNKNOWN';           // GET, POST, PUT, DELETE, etc.
    this.path = data.path || '/';                     // Route path (e.g., /api/users/:id)
    this.authenticated = data.authenticated || false; // Is authentication required?
    this.authType = data.authType || null;           // JWT, Session, Basic, API Key, Custom
    this.middleware = data.middleware || [];          // List of middleware functions
    this.file = data.file || null;                   // File where route is defined
    this.line = data.line || null;                   // Line number in file
    this.isPublic = data.isPublic || false;          // Is this intentionally public?
  }

  /**
   * Returns a string representation of the route.
   */
  toString() {
    return `${this.method.padEnd(6)} ${this.path}`;
  }

  /**
   * Returns authentication status as a string.
   */
  getAuthStatus() {
    if (this.isPublic) return 'Public';
    if (this.authenticated) return 'Yes';
    return 'No';
  }

  /**
   * Returns authentication type or reason for no auth.
   */
  getAuthTypeDisplay() {
    if (this.isPublic) return 'N/A (Public)';
    if (this.authenticated && this.authType) return this.authType;
    if (this.authenticated) return 'Custom';
    return 'N/A';
  }
}

/**
 * Collection of routes with analysis capabilities.
 */
export class RouteCollection {
  constructor() {
    this.routes = [];
  }

  /**
   * Add a route to the collection.
   */
  add(route) {
    if (route instanceof Route) {
      this.routes.push(route);
    } else {
      this.routes.push(new Route(route));
    }
  }

  /**
   * Get all routes.
   */
  getAll() {
    return this.routes;
  }

  /**
   * Get routes filtered by criteria.
   */
  filter(predicate) {
    return this.routes.filter(predicate);
  }

  /**
   * Get authenticated routes.
   */
  getAuthenticated() {
    return this.routes.filter(r => r.authenticated);
  }

  /**
   * Get unauthenticated routes (excluding public).
   */
  getUnauthenticated() {
    return this.routes.filter(r => !r.authenticated && !r.isPublic);
  }

  /**
   * Get public routes.
   */
  getPublic() {
    return this.routes.filter(r => r.isPublic);
  }

  /**
   * Get routes by method.
   */
  getByMethod(method) {
    return this.routes.filter(r => r.method.toUpperCase() === method.toUpperCase());
  }

  /**
   * Check if a route path is likely public/safe.
   */
  static isLikelyPublicRoute(path) {
    const publicPatterns = [
      // Health & monitoring
      /^\/health$/i,
      /^\/ping$/i,
      /^\/status$/i,
      /^\/metrics$/i,
      
      // Documentation
      /^\/docs?$/i,
      /^\/api-docs/i,
      /^\/swagger/i,
      
      // Static assets
      /^\/public\//i,
      /^\/static\//i,
      /^\/assets\//i,
      /^\/favicon\.ico$/i,
      /^\/robots\.txt$/i,
      
      // Authentication endpoints (public by design)
      /\/login$/i,
      /\/register$/i,
      /\/signup$/i,
      /\/sign-up$/i,
      /\/signin$/i,
      /\/sign-in$/i,
      /\/logout$/i,
      /\/signout$/i,
      /\/sign-out$/i,
      /\/refresh$/i,
      /\/forgot-password$/i,
      /\/reset-password$/i,
      /\/verify-email$/i,
      /\/resend-verification$/i,
      /\/client-token$/i,
      
      // Root path
      /^\/$/, // Root path often public
    ];

    return publicPatterns.some(pattern => pattern.test(path));
  }

  /**
   * Check if a route path is likely sensitive (should be protected).
   */
  static isLikelySensitiveRoute(path) {
    const sensitivePatterns = [
      /\/admin/i,
      /\/dashboard/i,
      /\/profile/i,
      /\/account/i,
      /\/settings/i,
      /\/users\/(?!login|register)/i,
      /\/delete/i,
      /\/update/i,
      /\/edit/i,
      /\/create/i,
      /\/payment/i,
      /\/order/i,
      /\/transaction/i,
    ];

    return sensitivePatterns.some(pattern => pattern.test(path));
  }

  /**
   * Analyze routes and return statistics.
   */
  getStats() {
    return {
      total: this.routes.length,
      authenticated: this.getAuthenticated().length,
      unauthenticated: this.getUnauthenticated().length,
      public: this.getPublic().length,
      byMethod: {
        GET: this.getByMethod('GET').length,
        POST: this.getByMethod('POST').length,
        PUT: this.getByMethod('PUT').length,
        DELETE: this.getByMethod('DELETE').length,
        PATCH: this.getByMethod('PATCH').length,
      },
    };
  }
}

/**
 * Authentication type detector.
 */
export class AuthTypeDetector {
  /**
   * Detect authentication type from middleware names and code patterns.
   */
  static detect(middleware, fileContent) {
    // Check middleware function names
    const middlewareStr = middleware.join(' ').toLowerCase();

    // JWT
    if (
      /jwt|jsonwebtoken|bearer/.test(middlewareStr) ||
      /verifyToken|validateToken|checkToken/.test(middlewareStr) ||
      /authorization.*bearer/i.test(fileContent)
    ) {
      return 'JWT';
    }

    // Session-based
    if (
      /session|express-session/.test(middlewareStr) ||
      /req\.session/i.test(fileContent)
    ) {
      return 'Session';
    }

    // Passport
    if (/passport/.test(middlewareStr)) {
      if (/passport-jwt/.test(fileContent)) return 'JWT (Passport)';
      if (/passport-local/.test(fileContent)) return 'Session (Passport)';
      return 'Passport';
    }

    // Basic Auth
    if (
      /basic.*auth/i.test(middlewareStr) ||
      /authorization.*basic/i.test(fileContent)
    ) {
      return 'Basic Auth';
    }

    // API Key
    if (
      /api.*key/i.test(middlewareStr) ||
      /x-api-key/i.test(fileContent)
    ) {
      return 'API Key';
    }

    // OAuth
    if (/oauth/.test(middlewareStr)) {
      return 'OAuth';
    }

    // Generic auth detected
    if (
      /auth|authenticate|requireAuth|isAuthenticated/.test(middlewareStr)
    ) {
      return 'Custom';
    }

    return null;
  }
}
