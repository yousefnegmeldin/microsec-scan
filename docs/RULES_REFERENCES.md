# Linking Security Rules to Research Literature

This section maps each detection rule in **MicroSec-Scan** to the **research paper(s)** that justify its existence and describe the associated security concern.  
Each table groups related rules under one major reference.

---

## 1. [Haindl et al., 2024 — *A Systematic Literature Review of Inter-Service Security Threats and Mitigation Strategies in Microservice Architectures*](https://ieeexplore.ieee.org/document/10750956)

This IEEE Access paper provides a taxonomy of **inter-service communication threats**, emphasizing encryption, authentication, and segmentation.

| Rule ID | Severity | Vulnerability Focus | Relation to Paper |
|----------|-----------|---------------------|-------------------|
| `MISSING_MUTUAL_TLS` | High | Unencrypted inter-service traffic | Paper highlights mTLS as essential for secure inter-service communication. |
| `MISSING_SERVICE_AUTH` | Critical | Lack of service-to-service authentication | Matches the “Token Pattern” and mutual authorization mechanisms discussed. |
| `EXCESSIVE_SERVICE_TRUST` | High | Flat network trust zones | Directly tied to their finding on missing micro-segmentation and least-privilege enforcement. |
| `EGRESS_INSECURE_HTTP` / `EGRESS_UNENCRYPTED_EXTERNAL_API` | High / Critical | Outbound calls over HTTP | Identified as common threat in distributed, cloud-based microservices. |
| `MISSING_CIRCUIT_BREAKER` | Medium | No traffic-control mechanism | Listed among resilience tactics mitigating cascading failures. |

---

## 2. [Ünver & Britto, 2023 — *Automatic Detection of Security Deficiencies and Refactoring Advises for Microservices (Pomegranate)*](https://ieeexplore.ieee.org/document/10169061)

Introduces a **static + automated scanning suite** combining open-source tools to detect container and code-level security issues.

| Rule ID | Severity | Vulnerability Focus | Relation to Paper |
|----------|-----------|---------------------|-------------------|
| `ROOT_CONTAINER` | Medium | Containers running as root | Pomegranate statically scans Dockerfiles for privilege escalation. |
| `DEFAULT_CREDENTIALS` | High | Use of default or weak credentials | Reported as frequent misconfiguration category. |
| `HARDCODED_SECRET` | High | Credentials embedded in code/config | Tool suite includes secret-detection stage. |
| `MISSING_HELMET` / `FASTIFY_MISSING_HELMET` / `NESTJS_MISSING_HELMET` | High | Missing HTTP header hardening | Matches “security header misconfiguration” category. |
| `MISSING_RATE_LIMITING` / `FASTIFY_MISSING_RATE_LIMIT` / `NESTJS_MISSING_RATE_LIMIT` | High | Lack of throttling → DoS risk | Covered under resource-consumption vulnerabilities. |
| `MISSING_BODY_SIZE_LIMIT` | Medium | Unbounded payloads | Pomegranate classifies as resource-exhaustion flaw. |

---

## 3. [Kalubowila et al., 2021 — *Optimization of Microservices Security*](https://ieeexplore.ieee.org/document/8030494)

Focuses on **Istio service-mesh**–based security, proxy validation, and latency reduction. Provides architectural justification for broker and inter-service isolation rules.

| Rule ID | Severity | Vulnerability Focus | Relation to Paper |
|----------|-----------|---------------------|-------------------|
| `PLAINTEXT_BROKER` / `EGRESS_INSECURE_RABBITMQ` | High | Non-TLS message brokers | Paper stresses mTLS in service mesh for safe inter-service traffic. |
| `SHARED_BROKER_CREDENTIALS` | High | Shared credentials between pods | Violates isolation and over-provisioning rules discussed. |
| `EXCESSIVE_SERVICE_TRUST` | High | Over-provisioned scopes | Aligns with their recommendation to validate scopes outside business logic. |
| `MISSING_MESSAGE_VALIDATION` | Medium | Lack of message parameter validation | Mirrors their “external validation model” before service entry. |

---

## 4. [Zdun et al., 2024 — *Detection Strategies for Microservice Security Tactics*](https://ieeexplore.ieee.org/document/10540127)

Proposes **model-based conformance checking** using *Architectural Design Decisions (ADDs)* to verify that security tactics (e.g., access management, traffic control) are applied consistently.

| Rule ID | Severity | Vulnerability Focus | Relation to Paper |
|----------|-----------|---------------------|-------------------|
| `MISSING_SERVICE_AUTH` | Critical | Missing inter-service auth controls | Maps to “access management” ADD detection. |
| `MISSING_MESSAGE_VALIDATION` | Medium | Schema/type mismatch | Matches message-validation and data-sanitization tactics. |
| `MISSING_CIRCUIT_BREAKER` | Medium | Absent traffic-control mechanisms | One of the studied ADDs in their traffic-control metric set. |
| `MISSING_MUTUAL_TLS` | High | No secure channel between services | Modeled as encryption/conformance metric in their study. |

---

## 5. [Mujahid et al., 2024 — *A Secure Digital Image Marketplace: Microservices and OWASP API Security Using Spring Boot*](https://ieeexplore.ieee.org/document/10125010)

Applies the **OWASP API Security Top 10 (2023)** to microservice architectures and serves as the baseline for your HTTP-level and middleware rules.

| Rule ID | Severity | Vulnerability Focus | Relation to Paper / OWASP Mapping |
|----------|-----------|---------------------|------------------------------------|
| `INSECURE_HTTP` / `EGRESS_INSECURE_HTTP` | Medium / High | Non-HTTPS transport | OWASP API6 & API8 – security misconfiguration. |
| `PERMISSIVE_CORS` / `FASTIFY_PERMISSIVE_CORS` / `NESTJS_PERMISSIVE_CORS` | Medium | Overly permissive origins | OWASP API8 – CORS misconfiguration. |
| `MISSING_AUTHENTICATION` / `UNPROTECTED_ROUTE` / `FASTIFY_MISSING_AUTH` / `NESTJS_MISSING_GUARDS` | High | No auth on sensitive routes | OWASP API1 & API2 – Broken Auth / Access Control. |
| `MISSING_HELMET` (family) | High | Missing security headers | OWASP API8 – Security Misconfiguration. |
| `MISSING_RATE_LIMITING` (family) | High | Missing throttling | OWASP API4 – Unrestricted Resource Consumption. |

---

## Summary

| Research Category | Core Contribution | Example Rule Themes |
|--------------------|-------------------|----------------------|
| **Haindl et al. 2024** | Inter-service threats & mitigation taxonomy | mTLS / Auth / Circuit Breaker |
| **Ünver & Britto 2023** | Automated detection & refactoring advice | Container / Code misconfigurations |
| **Kalubowila et al. 2021** | Service-mesh & broker-level security | TLS / Scope Validation / Isolation |
| **Zdun et al. 2024** | Architectural design-decision conformance | Access Mgmt / Traffic Control / Validation |
| **Mujahid et al. 2024** | OWASP API Top 10 applied to microservices | Auth / CORS / Rate Limit / Headers |

---

