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
    
    if (verbose) {
      console.log(`    RootContainers: ${rootContainerFindings.length}, DefaultCreds: ${defaultCredFindings.length}, PlaintextBroker: ${plaintextBrokerFindings.length}`);
    }
    
    findings.push(...rootContainerFindings);
    findings.push(...defaultCredFindings);
    findings.push(...plaintextBrokerFindings);
  } catch (err) {
    if (verbose) {
      console.error(`Error analyzing compose file: ${err.message}`);
    }
  }
  
  return findings;
}
