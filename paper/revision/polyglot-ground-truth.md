# Ground-truth annotation — polyglot benchmarks

**Provenance warning.** This annotation was produced by Claude (an AI
assistant), not by the five author-annotators, and not under the protocol
the manuscript describes (five independent annotators, disagreements
resolved in joint discussion). It must not be presented as if it were.
Either have the authors independently re-annotate and use that, or state
the provenance explicitly in the methodology. Every judgment below cites
the evidence it rests on so it can be checked and overridden.

Scope: annotation is at **system level** — does the system exhibit this
inter-service weakness, regardless of which service's language implements
it. A Node.js-scoped reading is given at the end, because the difference
is large and it matters for how recall should be reported.

Legend: P = present, A = absent, D = disputed.

## Annotation

| # | Category | Sock Shop | Online Boutique | Train Ticket |
|---|---|:-:|:-:|:-:|
| 1 | MISSING_SERVICE_AUTH | P | P | P |
| 2 | MISSING_MESSAGE_VALIDATION | P | A | P |
| 3 | KAFKA_MISSING_SCHEMA_VALIDATION | A | A | A |
| 4 | EXCESSIVE_SERVICE_TRUST | P | P | P |
| 5 | MISSING_MUTUAL_TLS | P | P | P |
| 6 | SHARED_BROKER_CREDENTIALS | P | A | P |
| 7 | MISSING_CIRCUIT_BREAKER | P | P | P |
| 8 | MISSING_REQUEST_SIGNING | P | P | P |
| 9 | SERVICE_REGISTRY_POISONING | A | A | P |
| 10 | MISSING_QUEUE_AUTHORIZATION | P | A | P |
| 11 | MISSING_MESSAGE_ENCRYPTION | P | A | P |
| 12 | EXPOSED_INTERNAL_PORT | D | A | P |
| 13 | UNENCRYPTED_SERVICE_MESH | A | P | A |
| 14 | EGRESS_INSECURE_HTTP | P | A | P |
| 15 | EGRESS_INSECURE_RABBITMQ | P | A | P |
| 16 | EGRESS_INSECURE_KAFKA | A | A | A |
| 17 | PLAINTEXT_BROKER | P | A | P |
| 18 | KAFKA_PLAINTEXT | A | A | A |
| 19 | KAFKA_MISSING_SASL | A | A | A |
| | **Present** | **12 (+1 D)** | **6** | **14** |

## Evidence

**Sock Shop.** Inter-service calls carry no credential: the front-end's
`helpers.simpleHttpRequest(url, res, next)` (`helpers/index.js:93-98`)
passes only a URL to `request.get`, so 1, 8 and 14 hold. All traffic is
plain HTTP on a single flat Compose network with no per-service network
restriction, giving 4 and 5. RabbitMQ is declared as `rabbitmq:3.6.8`
(`deploy/docker-compose/docker-compose.yml:124-126`) with no credential,
vhost, ACL or TLS configuration anywhere in the Compose files, so it runs
on default `guest`/`guest` over `amqp://` — giving 6, 10, 11, 15 and 17.
No breaker library appears in the front-end (7). Discovery is
Compose/Kubernetes DNS with no Consul or Eureka, so 9 is absent, and no
mesh is deployed, so 13 is absent.

Category 12 is **disputed**. In the core Compose file only `edge-router`
publishes ports (80, 8080); every other service is unpublished, which is
correct segmentation and argues absent. The 8 instances MicroSec-Scan
reported come from `docker-compose.monitoring.yml` and
`docker-compose.logging.yml`, which publish Prometheus, Grafana,
Elasticsearch and Kibana to the host. Whether publishing an ops stack is
a finding is a genuine judgment call — a reviewer could defend either
label, so it should not be silently counted as a true positive or a false
positive.

**Online Boutique.** `grpc.credentials.createInsecure()` appears on both
sides — `src/currencyservice/client.js:29` and
`src/currencyservice/server.js:190` — so inter-service transport is
unauthenticated and unencrypted, giving 1, 5 and 8. No NetworkPolicy
exists in `kubernetes-manifests/`, giving 4. No breaker wraps the gRPC
stubs (7). `istio-manifests/` contains only `frontend-gateway.yaml`,
`frontend.yaml` and `allow-egress-googleapis.yaml` — no
`PeerAuthentication` and no `STRICT` mTLS anywhere — so 13 is present.
There is no message broker at all, so 2, 6, 10, 11, 15, 17 and all Kafka
categories are absent. Only the frontend is externally reachable; the
rest are ClusterIP, so 12 is absent.

**Train Ticket.** Services resolve each other through Eureka/Nacos
(`*/src/main/resources/application.yml`) with no registry authentication,
giving 9. RabbitMQ is configured as `host: ${rabbitmq_host:localhost}`,
`port: 5672` (`ts-notification-service/.../application.yml:38-40`) — plain
AMQP, no credentials, no TLS, no ACLs — giving 6, 10, 11, 15 and 17.
Feign clients pass `HttpHeaders` between services
(`ts-travel-service/.../TravelService.java:18-22`) without a service
identity or signature, giving 1 and 8. Flat network (4), plain HTTP
between services (5, 14), no breakers (7). The root `docker-compose.yml`
publishes service ports broadly, giving 12. Kafka is commented out
(`docker-compose.yml:12-13`), so all Kafka categories are absent, and no
mesh is deployed (13 absent).

## Resulting metrics

Using the whole-repository scans:

| System | Present | Detected | TP | FP | Recall | Precision |
|---|---:|---:|---:|---:|---:|---:|
| Sock Shop | 12 | 1 (cat 12, disputed) | 0–1 | 0–1 | 0.00–0.08 | 0.00–1.00 |
| Online Boutique | 6 | 0 | 0 | 0 | 0.00 | n/a |
| Train Ticket | 14 | 1 (cat 12) | 1 | 0 | 0.07 | 1.00 |

## What this means for the paper

This is a materially worse result than the per-service scan suggested, and
it should change how the polyglot section is used.

Recall is effectively zero on all three. The cause is not that the
vulnerabilities are absent — 12, 6 and 14 categories are present
respectively — but that on these systems the inter-service logic lives in
Go and Java services, and the paths that are Node.js are defeated by the
`request` client and helper indirection already documented. The only
category detected anywhere is the Compose-level one, which is
language-agnostic.

Two honest options:

1. **Report it as a scope and limitation analysis**, which is what
   `polyglot-evaluation.tex` does. The claim becomes "the tool runs on
   these benchmarks and its boundary is X", not "the tool performs well on
   these benchmarks". This answers Reviewer #4's applicability objection
   without overclaiming, and the zero recall is stated plainly.
2. **Fix the transport and client gaps first, then re-measure.** Adding
   `request`/`got`/`superagent` to the recognized client set and a bounded
   interprocedural pass for helper wrappers would plausibly move Sock Shop
   from 0 to several categories; gRPC support would do the same for Online
   Boutique. This is the stronger paper but is real implementation work.

What should **not** happen is pasting these recall figures into the main
accuracy table beside the existing five applications, which would read as
a collapse in tool quality rather than a scope boundary.

The disputed category 12 should be resolved by the authors before any of
these numbers are used, since with 3 systems it swings both Sock Shop's
precision and its recall.

## Baseline results on the same subjects

Trivy v0.58.1 (`trivy fs`) and Semgrep 1.173.0. Semgrep was run offline
against the cloned open-source rule corpus (`semgrep/semgrep-rules`,
198 JavaScript/TypeScript rules) because the hosted registry
(`semgrep.dev`) is blocked by this environment's network policy, so
`semgrep ci` could not be reproduced. V excludes dependency findings,
per the protocol used in the manuscript.

| Benchmark | Tool | V | ISV | Time (s) | Note |
|---|---|---:|---:|---:|---|
| Sock Shop | MicroSec-Scan | 46 | 8 | 0.49 | 1 category, disputed |
| | Trivy | 0 | 0 | 0.13 | 0 dependency findings too |
| | Semgrep | 0 | 0 | 106.15 | no JS source in deploy repo |
| Online Boutique | MicroSec-Scan | 0 | 0 | 0.62 | |
| | Trivy | 0 | 0 | 2.30 | 223 dependency findings excluded |
| | Semgrep | 9 | **1** | 106.23 | **detects insecure gRPC** |
| Train Ticket | MicroSec-Scan | 374 | 134 | 5.63 | 1 category |
| | Trivy | 0 | 0 | 12.60 | 651 dependency findings excluded |
| | Semgrep | 589 | 0 | 244.78 | all client-side/local |

### The result that matters

On Online Boutique, **Semgrep detects an inter-service vulnerability that
MicroSec-Scan does not.** The rule
`javascript.grpc.security.grpc-nodejs-insecure-connection` matches
`grpc.credentials.createInsecure()` at
`src/currencyservice/client.js:21` — the same unencrypted inter-service
transport annotated as present (category 5) above.

This is the first subject in the whole evaluation where a baseline beats
MicroSec-Scan on inter-service detection, and it directly qualifies the
manuscript's claim that the baselines report zero inter-service findings.

The mechanism argument survives: the Semgrep rule is a single-file pattern
match on a constructor argument and reconstructs no cross-service path. But
the coverage argument does not. On a transport MicroSec-Scan does not
model, rule breadth alone is sufficient to win, and no amount of
architectural reasoning compensates for a missing transport.

The practical implication is that gRPC support is not merely future work —
a competitor demonstrably covers it today on a benchmark the reviewers
named. That strengthens the case for implementing gRPC egress before
resubmission rather than after.

Semgrep's 589 Train Ticket findings are client-side and local (383 `alert`
uses, 125 jQuery/DOM sinks, 4 SQL injections, 9 open redirects); none are
inter-service, so the broader claim holds everywhere except Online
Boutique.
