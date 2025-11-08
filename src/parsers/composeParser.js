import fs from "fs";
import yaml from "js-yaml";
import { RULES, createFinding } from "../rules/registry.js";

/**
 * Finds the line number of a string in file content.
 */
function findLineNumber(content, searchString, startLine = 0) {
  const lines = content.split('\n');
  for (let i = startLine; i < lines.length; i++) {
    if (lines[i].includes(searchString)) {
      return i + 1;
    }
  }
  return undefined;
}

/**
 * Checks for containers running as root.
 */
function checkRootContainers(file, rawContent, doc) {
  const findings = [];
  
  for (const [svc, cfg] of Object.entries(doc.services || {})) {
    if (cfg.user === "root" || !cfg.user) {
      const serviceLine = findLineNumber(rawContent, `${svc}:`);
      findings.push(createFinding(
        "ROOT_CONTAINER",
        file,
        serviceLine,
        `${svc} container runs as root`
      ));
    }
  }
  
  return findings;
}

/**
 * Checks for default credentials in environment variables.
 */
function checkDefaultCredentials(file, rawContent, doc) {
  const findings = [];
  
  for (const [svc, cfg] of Object.entries(doc.services || {})) {
    const serviceLine = findLineNumber(rawContent, `${svc}:`);
    const serviceStartLine = serviceLine ? serviceLine - 1 : 0;
    
    if (cfg.environment) {
      for (const [k, v] of Object.entries(cfg.environment)) {
        if (/guest:guest|admin:admin/i.test(v)) {
          const line = findLineNumber(rawContent, v, serviceStartLine);
          findings.push(createFinding(
            "DEFAULT_CREDENTIALS",
            file,
            line,
            `${svc} uses default credentials (${v})`
          ));
        }
      }
    }
  }
  
  return findings;
}

/**
 * Checks for plaintext message broker connections.
 */
function checkPlaintextBroker(file, rawContent, doc) {
  const findings = [];
  
  for (const [svc, cfg] of Object.entries(doc.services || {})) {
    const serviceLine = findLineNumber(rawContent, `${svc}:`);
    const serviceStartLine = serviceLine ? serviceLine - 1 : 0;
    
    if (cfg.environment) {
      for (const [k, v] of Object.entries(cfg.environment)) {
        if (typeof v === "string" && v.startsWith("amqp://")) {
          const line = findLineNumber(rawContent, v, serviceStartLine);
          findings.push(createFinding(
            "PLAINTEXT_BROKER",
            file,
            line,
            `${svc} connects to RabbitMQ without TLS`
          ));
        }
      }
    }
  }
  
  return findings;
}

/**
 * Checks for services with excessive network access (violates least privilege).
 */
function checkExcessiveNetworkAccess(file, rawContent, doc) {
  const findings = [];
  
  for (const [svc, cfg] of Object.entries(doc.services || {})) {
    const serviceLine = findLineNumber(rawContent, `${svc}:`);
    
    if (cfg.networks) {
      const networks = Array.isArray(cfg.networks) 
        ? cfg.networks 
        : Object.keys(cfg.networks);
      
      if (networks.length > 2) {
        findings.push(createFinding(
          "EXCESSIVE_SERVICE_TRUST",
          file,
          serviceLine,
          `${svc} has access to ${networks.length} networks (${networks.join(', ')}). Consider least privilege principle.`
        ));
      }
    }
  }
  
  return findings;
}

/**
 * Checks for shared RabbitMQ credentials across services.
 */
function checkSharedBrokerCredentials(file, rawContent, doc) {
  const findings = [];
  const credentialMap = new Map();
  
  // Build map of credentials to services
  for (const [svc, cfg] of Object.entries(doc.services || {})) {
    if (cfg.environment) {
      let rabbitUser = null;
      
      // Check for explicit user env var
      rabbitUser = cfg.environment.RABBITMQ_USER || cfg.environment.RABBITMQ_USERNAME;
      
      // If not found, parse from connection string
      if (!rabbitUser) {
        const connectionString = cfg.environment.RABBITMQ_URL || 
                                cfg.environment.RABBITMQ_URI || 
                                cfg.environment.AMQP_URL;
        
        if (connectionString && typeof connectionString === 'string') {
          // Parse amqp://user:pass@host:port format
          const match = connectionString.match(/amqps?:\/\/([^:]+):[^@]+@/);
          if (match) {
            rabbitUser = match[1];
          }
        }
      }
      
      if (rabbitUser && typeof rabbitUser === 'string') {
        if (!credentialMap.has(rabbitUser)) {
          credentialMap.set(rabbitUser, []);
        }
        credentialMap.get(rabbitUser).push(svc);
      }
    }
  }
  
  // Flag credentials shared by multiple services
  for (const [user, services] of credentialMap.entries()) {
    if (services.length > 1) {
      for (const svc of services) {
        const serviceLine = findLineNumber(rawContent, `${svc}:`);
        findings.push(createFinding(
          "SHARED_BROKER_CREDENTIALS",
          file,
          serviceLine,
          `${svc} shares RabbitMQ credentials '${user}' with ${services.length - 1} other service(s): ${services.filter(s => s !== svc).join(', ')}`
        ));
      }
    }
  }
  
  return findings;
}

/**
 * Checks for exposed internal ports (0.0.0.0 binding).
 */
function checkExposedInternalPorts(file, rawContent, doc) {
  const findings = [];
  
  for (const [svc, cfg] of Object.entries(doc.services || {})) {
    const serviceLine = findLineNumber(rawContent, `${svc}:`);
    
    if (cfg.ports) {
      for (const portMapping of cfg.ports) {
        const portStr = String(portMapping);
        
        // Check for 0.0.0.0 binding or ports without host restriction
        // Format: "0.0.0.0:8080:8080" or "8080:8080" (which defaults to 0.0.0.0)
        if (portStr.includes('0.0.0.0') || /^\d+:\d+$/.test(portStr)) {
          const line = findLineNumber(rawContent, portStr, serviceLine ? serviceLine - 1 : 0);
          findings.push(createFinding(
            "EXPOSED_INTERNAL_PORT",
            file,
            line,
            `${svc} exposes port ${portStr} to all network interfaces (0.0.0.0). Consider binding to 127.0.0.1 for internal services.`
          ));
        }
      }
    }
  }
  
  return findings;
}

/**
 * Checks for service registry (Consul/Eureka) without authentication.
 */
function checkServiceRegistrySecurity(file, rawContent, doc) {
  const findings = [];
  
  for (const [svc, cfg] of Object.entries(doc.services || {})) {
    const serviceLine = findLineNumber(rawContent, `${svc}:`);
    
    // Check if this is a Consul or Eureka service
    const isConsul = cfg.image && cfg.image.includes('consul');
    const isEureka = cfg.image && cfg.image.includes('eureka') || 
                     (cfg.environment && JSON.stringify(cfg.environment).includes('eureka'));
    
    if (isConsul || isEureka) {
      const registryType = isConsul ? 'Consul' : 'Eureka';
      let hasAuth = false;
      
      // Check for authentication configuration
      if (cfg.environment) {
        const envVars = JSON.stringify(cfg.environment).toLowerCase();
        hasAuth = envVars.includes('acl') || 
                  envVars.includes('token') || 
                  envVars.includes('auth') ||
                  envVars.includes('security');
      }
      
      // Check command args for ACL configuration
      if (cfg.command) {
        const cmdStr = String(cfg.command).toLowerCase();
        hasAuth = hasAuth || cmdStr.includes('acl') || cmdStr.includes('auth');
      }
      
      if (!hasAuth) {
        findings.push(createFinding(
          "SERVICE_REGISTRY_POISONING",
          file,
          serviceLine,
          `${svc} (${registryType}) lacks authentication/ACL configuration - vulnerable to registry poisoning attacks`
        ));
      }
    }
  }
  
  return findings;
}

/**
 * Checks for service mesh (Istio/Linkerd) without TLS enforcement.
 */
function checkServiceMeshEncryption(file, rawContent, doc) {
  const findings = [];
  
  // Check if Istio or Linkerd is configured
  const docStr = JSON.stringify(doc).toLowerCase();
  const hasIstio = docStr.includes('istio') || docStr.includes('istiod');
  const hasLinkerd = docStr.includes('linkerd');
  
  if (hasIstio || hasLinkerd) {
    const meshType = hasIstio ? 'Istio' : 'Linkerd';
    let hasMTLS = false;
    
    // Check for mTLS configuration in services
    for (const [svc, cfg] of Object.entries(doc.services || {})) {
      if (cfg.environment) {
        const envVars = JSON.stringify(cfg.environment).toLowerCase();
        if (envVars.includes('mtls') || 
            envVars.includes('mutual_tls') ||
            envVars.includes('tls_mode') ||
            envVars.includes('peer_authentication')) {
          hasMTLS = true;
          break;
        }
      }
      
      if (cfg.labels) {
        const labels = JSON.stringify(cfg.labels).toLowerCase();
        if (labels.includes('mtls') || labels.includes('security.istio.io')) {
          hasMTLS = true;
          break;
        }
      }
    }
    
    if (!hasMTLS) {
      findings.push(createFinding(
        "UNENCRYPTED_SERVICE_MESH",
        file,
        1,
        `${meshType} service mesh detected but mTLS/TLS enforcement not configured - traffic between services is unencrypted`
      ));
    }
  }
  
  return findings;
}

/**
 * Analyzes docker-compose.yml for security issues.
 */
export function analyzeCompose(file, verbose = false) {
  const findings = [];
  
  try {
    const rawContent = fs.readFileSync(file, "utf8");
    const doc = yaml.load(rawContent);
    
    const rootContainerFindings = checkRootContainers(file, rawContent, doc);
    const defaultCredFindings = checkDefaultCredentials(file, rawContent, doc);
    const plaintextBrokerFindings = checkPlaintextBroker(file, rawContent, doc);
    const excessiveNetworkFindings = checkExcessiveNetworkAccess(file, rawContent, doc);
    const sharedCredsFindings = checkSharedBrokerCredentials(file, rawContent, doc);
    const exposedPortFindings = checkExposedInternalPorts(file, rawContent, doc);
    const registrySecurityFindings = checkServiceRegistrySecurity(file, rawContent, doc);
    const meshEncryptionFindings = checkServiceMeshEncryption(file, rawContent, doc);
    
    findings.push(...rootContainerFindings);
    findings.push(...defaultCredFindings);
    findings.push(...plaintextBrokerFindings);
    findings.push(...excessiveNetworkFindings);
    findings.push(...sharedCredsFindings);
    findings.push(...exposedPortFindings);
    findings.push(...registrySecurityFindings);
    findings.push(...meshEncryptionFindings);
  } catch (err) {
    if (verbose) {
      console.error(`Error analyzing compose file: ${err.message}`);
    }
  }
  
  return findings;
}
